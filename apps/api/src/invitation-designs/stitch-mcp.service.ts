import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp';
const MCP_PROTOCOL_VERSION = '2026-07-28';
const REQUEST_TIMEOUT_MS = 240_000;
const MODEL_SCHEMA_TIMEOUT_MS = 10_000;
const MODEL_SCHEMA_CACHE_MS = 5 * 60_000;
const MAX_HTML_BYTES = 80_000;
const SAFE_DOWNLOAD_HOSTS = [
  'googleapis.com',
  'googleusercontent.com',
  'contribution.usercontent.google.com',
];

type JsonRecord = Record<string, unknown>;

export type StitchNormalizedHtml = {
  title: string;
  description: string;
  body: string;
  css: string;
};

export type StitchGeneratedHtml = StitchNormalizedHtml & {
  projectId: string;
  screenId: string;
  modelId?: string;
};

export type StitchModelOption = {
  id: string;
  name: string;
  description: string;
  operations: ['generation'];
  tier: 'standard';
  available: true;
};

@Injectable()
export class StitchMcpService {
  private readonly logger = new Logger(StitchMcpService.name);
  private requestId = 0;
  private modelOptionsCache: { expiresAt: number; models: StitchModelOption[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  async getModelOptions(signal?: AbortSignal): Promise<{ models: StitchModelOption[] }> {
    if (this.modelOptionsCache && this.modelOptionsCache.expiresAt > Date.now()) {
      return { models: this.modelOptionsCache.models.map((model) => ({ ...model })) };
    }
    const apiKey = this.config.get<string>('stitchApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Stitch is not configured on the API server.');
    }
    const timeoutSignal = AbortSignal.timeout(MODEL_SCHEMA_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const response = await fetch(STITCH_MCP_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextId(),
        method: 'tools/list',
        params: { _meta: { 'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION } },
      }),
      signal: requestSignal,
    });
    if (!response.ok) {
      throw new ServiceUnavailableException('Stitch model availability is unavailable.');
    }
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    const parsed = contentType.includes('text/event-stream') ? parseSseJson(text) : parseJson(text);
    const result = record(parsed.result);
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    const generationTool = tools
      .map(record)
      .find((tool) => tool?.name === 'generate_screen_from_text');
    const inputSchema = record(generationTool?.inputSchema);
    const properties = record(inputSchema?.properties);
    const modelSchema = record(properties?.modelId);
    const ids = Array.isArray(modelSchema?.enum)
      ? modelSchema.enum.filter(
          (id): id is string =>
            typeof id === 'string' && id.length <= 120 && id !== 'MODEL_ID_UNSPECIFIED'
        )
      : [];
    const descriptions = Array.isArray(modelSchema?.['x-google-enum-descriptions'])
      ? modelSchema['x-google-enum-descriptions']
      : [];
    const allIds = Array.isArray(modelSchema?.enum) ? modelSchema.enum : [];
    const models = ids.flatMap<StitchModelOption>((id) => {
      const index = allIds.indexOf(id);
      const rawLabel = descriptions[index];
      if (typeof rawLabel !== 'string' || !rawLabel.trim()) return [];
      const label = rawLabel.trim().replace(/[.]$/, '');
      return [
        {
          id,
          name: `Stitch — ${label}`,
          description: `Generate the invitation with ${label} in Stitch.`,
          operations: ['generation'],
          tier: 'standard',
          available: true,
        },
      ];
    });
    if (!models.length) {
      throw new ServiceUnavailableException('Stitch model availability is unavailable.');
    }
    this.modelOptionsCache = { expiresAt: Date.now() + MODEL_SCHEMA_CACHE_MS, models };
    return { models: models.map((model) => ({ ...model })) };
  }

  async generateHtml(input: {
    prompt: string;
    event: {
      title: string;
      eventType: string;
      description: string | null;
      eventDate: string;
      startTime: string | null;
      venueName: string | null;
      venueAddress: string | null;
    };
    modelId?: string;
    explicitImages?: Array<{ id: string; fileName: string }>;
    signal?: AbortSignal;
    onProgress?: (stage: 'PARSING_RESPONSE') => void;
  }): Promise<StitchGeneratedHtml> {
    const apiKey = this.config.get<string>('stitchApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Stitch is not configured on the API server.');
    }
    const modelId = input.modelId?.trim();
    if (modelId) {
      const { models } = await this.getModelOptions(input.signal);
      if (!models.some((model) => model.id === modelId)) {
        throw new BadRequestException('The selected Stitch model is not supported.');
      }
    }

    let projectId: string | null = null;
    let screenId: string | null = null;
    let failureStage = 'create_project';
    const startedAt = Date.now();

    try {
      const projectResult = await this.callTool(
        apiKey,
        'create_project',
        {
          title: `Invitation ${input.event.title}`.slice(0, 120),
        },
        input.signal,
        { failureStage }
      );
      const projectName = firstString(projectResult, ['name', 'project.name']);
      projectId = resourceId(projectName, 'projects');
      if (!projectId) throw new Error('invalid-project-response');
      this.logDiagnostic({
        operation: 'create_project',
        projectId,
        screenId: null,
        httpStatus: 200,
        responseShape: responseShape(projectResult),
        elapsedMs: Date.now() - startedAt,
        failureStage: 'complete',
      });

      failureStage = 'generate_screen_from_text';
      const generationResult = await this.callTool(
        apiKey,
        'generate_screen_from_text',
        {
          projectId,
          deviceType: 'DESKTOP',
          prompt: this.designPrompt(input.prompt, input.event, input.explicitImages ?? []),
          ...(modelId ? { modelId } : {}),
        },
        input.signal,
        { projectId, failureStage }
      );

      input.onProgress?.('PARSING_RESPONSE');
      failureStage = 'identify_generated_screen';
      let screen = firstGeneratedScreen(generationResult);
      if (!screen) throw new Error('generated-screen-not-in-response');
      screenId = generatedScreenId(screen);
      this.logDiagnostic({
        operation: 'identify_generated_screen',
        projectId,
        screenId,
        httpStatus: 200,
        responseShape: responseShape(generationResult),
        elapsedMs: Date.now() - startedAt,
        failureStage: 'complete',
      });

      let htmlUrl = screen ? downloadUrl(screen.htmlCode) : null;
      if (!htmlUrl && screen) {
        if (!screenId) throw new Error('generated-screen-id-missing');
        failureStage = 'get_screen';
        screen = record(
          await this.callTool(
            apiKey,
            'get_screen',
            {
              name: `projects/${projectId}/screens/${screenId}`,
            },
            input.signal,
            { projectId, screenId, failureStage }
          )
        );
        htmlUrl = screen ? downloadUrl(screen.htmlCode) : null;
      }
      if (!htmlUrl) throw new Error('missing-html-download-url');

      failureStage = 'download_html';
      const html = await this.downloadHtml(htmlUrl, input.signal, {
        projectId,
        screenId,
        failureStage,
      });
      failureStage = 'normalize_html';
      const normalized = normalizeStitchHtml(
        html,
        screen ? firstString(screen, ['title']) : null,
        input.event
      );
      this.logDiagnostic({
        operation: 'normalize_html',
        projectId,
        screenId,
        httpStatus: null,
        responseShape: ['title', 'description', 'body', 'css'],
        elapsedMs: Date.now() - startedAt,
        failureStage: 'complete',
      });
      if (!screenId) throw new Error('generated-screen-id-missing');
      return {
        ...normalized,
        projectId,
        screenId,
        ...(modelId ? { modelId } : {}),
      };
    } catch (error) {
      this.logDiagnostic({
        operation: failureStage,
        projectId,
        screenId,
        httpStatus: null,
        responseShape: [],
        elapsedMs: Date.now() - startedAt,
        failureStage,
      });
      if (error instanceof ServiceUnavailableException || error instanceof BadGatewayException) {
        throw error;
      }
      if (input.signal?.aborted) throw error;
      throw new BadGatewayException('Stitch could not generate this invitation. Please try again.');
    }
  }

  /** Uses Stitch's official existing-screen edit operation; it never creates a replacement project. */
  async editHtml(input: {
    prompt: string;
    event: {
      title: string;
      eventType: string;
      description: string | null;
      eventDate: string;
      startTime: string | null;
      venueName: string | null;
      venueAddress: string | null;
    };
    projectId: string;
    screenId: string;
    modelId?: string;
    explicitImages?: Array<{ id: string; fileName: string }>;
    signal?: AbortSignal;
    onProgress?: (stage: 'PARSING_RESPONSE') => void;
  }): Promise<StitchGeneratedHtml> {
    const apiKey = this.config.get<string>('stitchApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Stitch is not configured on the API server.');
    }
    const modelId = input.modelId?.trim();
    if (modelId) {
      const { models } = await this.getModelOptions(input.signal);
      if (!models.some((model) => model.id === modelId)) {
        throw new BadRequestException('The selected Stitch model is not supported.');
      }
    }

    let editedScreenId: string | null = null;
    let failureStage = 'edit_screens';
    const startedAt = Date.now();
    try {
      const editResult = await this.callTool(
        apiKey,
        'edit_screens',
        {
          projectId: input.projectId,
          selectedScreenIds: [input.screenId],
          deviceType: 'DESKTOP',
          prompt: this.editPrompt(input.prompt, input.event, input.explicitImages ?? []),
          ...(modelId ? { modelId } : {}),
        },
        input.signal,
        { projectId: input.projectId, screenId: input.screenId, failureStage }
      );
      input.onProgress?.('PARSING_RESPONSE');
      failureStage = 'identify_edited_screen';
      let screen = firstGeneratedScreen(editResult);
      if (!screen) throw new Error('edited-screen-not-in-response');
      editedScreenId = generatedScreenId(screen);
      if (!editedScreenId) throw new Error('edited-screen-id-missing');
      let htmlUrl = downloadUrl(screen.htmlCode);
      if (!htmlUrl) {
        failureStage = 'get_screen';
        screen = record(
          await this.callTool(
            apiKey,
            'get_screen',
            { name: `projects/${input.projectId}/screens/${editedScreenId}` },
            input.signal,
            { projectId: input.projectId, screenId: editedScreenId, failureStage }
          )
        );
        htmlUrl = screen ? downloadUrl(screen.htmlCode) : null;
      }
      if (!htmlUrl) throw new Error('missing-html-download-url');
      failureStage = 'download_html';
      const html = await this.downloadHtml(htmlUrl, input.signal, {
        projectId: input.projectId,
        screenId: editedScreenId,
        failureStage,
      });
      const normalized = normalizeStitchHtml(
        html,
        screen ? firstString(screen, ['title']) : null,
        input.event
      );
      this.logDiagnostic({
        operation: 'edit_screens',
        projectId: input.projectId,
        screenId: editedScreenId,
        httpStatus: 200,
        responseShape: ['title', 'description', 'body', 'css'],
        elapsedMs: Date.now() - startedAt,
        failureStage: 'complete',
      });
      return {
        ...normalized,
        projectId: input.projectId,
        screenId: editedScreenId,
        ...(modelId ? { modelId } : {}),
      };
    } catch (error) {
      this.logDiagnostic({
        operation: failureStage,
        projectId: input.projectId,
        screenId: editedScreenId ?? input.screenId,
        httpStatus: null,
        responseShape: [],
        elapsedMs: Date.now() - startedAt,
        failureStage,
      });
      if (error instanceof ServiceUnavailableException || error instanceof BadGatewayException) {
        throw error;
      }
      if (input.signal?.aborted) throw error;
      throw new BadGatewayException('Stitch could not update this invitation. Please try again.');
    }
  }

  private async callTool(
    apiKey: string,
    name: string,
    args: JsonRecord,
    signal: AbortSignal | undefined,
    context: { projectId?: string | null; screenId?: string | null; failureStage: string }
  ): Promise<unknown> {
    const result = record(
      await this.request(
        apiKey,
        name,
        {
          name,
          arguments: args,
          _meta: { 'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION },
        },
        signal,
        context
      )
    );
    if (!result) throw new Error('invalid-mcp-tool-response');
    if (result.isError === true) throw new Error('stitch-tool-call-failed');
    if (result.structuredContent !== undefined) return result.structuredContent;

    const textBlock = Array.isArray(result.content)
      ? result.content.find((part) => record(part)?.type === 'text')
      : undefined;
    const text = record(textBlock)?.text;
    if (typeof text === 'string') {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new Error('invalid-mcp-tool-content');
      }
    }
    return result;
  }

  private async request(
    apiKey: string,
    toolName: string,
    params: JsonRecord,
    signal: AbortSignal | undefined,
    context: { projectId?: string | null; screenId?: string | null; failureStage: string }
  ): Promise<unknown> {
    const startedAt = Date.now();
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const headers: Record<string, string> = {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      'Mcp-Method': 'tools/call',
      'Mcp-Name': toolName,
    };

    const response = await fetch(STITCH_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextId(),
        method: 'tools/call',
        params,
      }),
      signal: requestSignal,
    });
    if (!response.ok) {
      this.logDiagnostic({
        operation: toolName,
        projectId: context.projectId ?? null,
        screenId: context.screenId ?? null,
        httpStatus: response.status,
        responseShape: [],
        elapsedMs: Date.now() - startedAt,
        failureStage: context.failureStage,
      });
      throw new Error(`stitch-http-${response.status}`);
    }

    const text = await response.text();
    if (!text.trim()) throw new Error('empty-stitch-response');

    const contentType = response.headers.get('content-type') ?? '';
    const parsed = contentType.includes('text/event-stream') ? parseSseJson(text) : parseJson(text);
    const error = record(parsed.error);
    const result = parsed.result;
    this.logDiagnostic({
      operation: toolName,
      projectId: context.projectId ?? null,
      screenId: context.screenId ?? null,
      httpStatus: response.status,
      responseShape: responseShape(result),
      elapsedMs: Date.now() - startedAt,
      failureStage: error ? context.failureStage : 'complete',
    });
    if (error) throw new Error('stitch-mcp-request-failed');
    return result;
  }

  private async downloadHtml(
    url: string,
    signal: AbortSignal | undefined,
    context: { projectId: string | null; screenId: string | null; failureStage: string }
  ): Promise<string> {
    const startedAt = Date.now();
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      !SAFE_DOWNLOAD_HOSTS.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      )
    ) {
      throw new Error('unsafe-stitch-download-url');
    }
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const response = await fetch(parsed, { signal: requestSignal, redirect: 'error' });
    if (!response.ok) {
      this.logDiagnostic({
        operation: 'download_html',
        projectId: context.projectId,
        screenId: context.screenId,
        httpStatus: response.status,
        responseShape: [],
        elapsedMs: Date.now() - startedAt,
        failureStage: context.failureStage,
      });
      throw new Error(`stitch-html-download-${response.status}`);
    }
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_HTML_BYTES) throw new Error('stitch-html-too-large');
    const html = await response.text();
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error('stitch-html-too-large');
    this.logDiagnostic({
      operation: 'download_html',
      projectId: context.projectId,
      screenId: context.screenId,
      httpStatus: response.status,
      responseShape: ['html:string'],
      elapsedMs: Date.now() - startedAt,
      failureStage: 'complete',
    });
    return html;
  }

  private logDiagnostic(details: {
    operation: string;
    projectId: string | null;
    screenId: string | null;
    httpStatus: number | null;
    responseShape: string[];
    elapsedMs: number;
    failureStage: string;
  }): void {
    this.logger.debug(JSON.stringify(details));
  }

  private nextId(): number {
    this.requestId += 1;
    return this.requestId;
  }

  private designPrompt(
    userPrompt: string,
    event: {
      title: string;
      eventType: string;
      description: string | null;
      eventDate: string;
      startTime: string | null;
      venueName: string | null;
      venueAddress: string | null;
    },
    explicitImages: Array<{ id: string; fileName: string }>
  ): string {
    const brief = [userPrompt.trim(), event.description?.trim() ?? ''].filter(Boolean).join('\n\n');

    return [
      'Create one beautiful, unique, responsive invitation based on the complete user request below.',
      'The user request is the primary creative source. Use your creative judgment for the visual design, composition, typography, colors, layout, spacing, and imagery unless the user explicitly specifies them.',
      'Use appropriate Stitch-generated imagery when it improves the design, especially when the user requests photography or decorative imagery. Preserve official Stitch-hosted HTTPS image references in the HTML.',
      'Return a complete HTML document with semantic body markup and CSS in one or more style tags.',
      'Keep the document static: do not use scripts, event handlers, executable content, forms, external fonts, frameworks, remote stylesheets, or arbitrary third-party resources.',
      'Generate visual invitation design and user-requested invitation content only. Do not generate RSVP sections, forms, buttons, controls, functionality, or logic; the SaaS renders RSVP separately outside this document. Do not generate countdown timers or countdown displays, authentication, billing, or credits.',
      'Keep the design self-contained, readable, and suitable for publication after HTML sanitization.',
      'EVENT DETAILS:',
      `Event title: ${event.title}`,
      `Event type: ${event.eventType}`,
      `Date: ${event.eventDate}`,
      ...(event.startTime ? [`Start time: ${event.startTime}`] : []),
      ...(event.venueName ? [`Venue: ${event.venueName}`] : []),
      ...(event.venueAddress ? [`Venue address: ${event.venueAddress}`] : []),
      ...(event.description ? [`Event description: ${event.description}`] : []),
      'COMPLETE USER REQUEST (authoritative):',
      brief,
      ...(explicitImages.length
        ? [
            'EXPLICIT USER IMAGE REQUEST:',
            `The user explicitly selected ${explicitImages.length} private uploaded image(s): ${explicitImages.map((image) => image.fileName).join(', ')}. Plan prominent image placements for them. The application will securely bind the actual private images after generation; do not invent URLs or claim visual details you cannot inspect.`,
          ]
        : []),
    ].join('\n');
  }

  private editPrompt(
    instruction: string,
    event: {
      title: string;
      eventType: string;
      description: string | null;
      eventDate: string;
      startTime: string | null;
      venueName: string | null;
      venueAddress: string | null;
    },
    explicitImages: Array<{ id: string; fileName: string }>
  ): string {
    return [
      'Edit the selected invitation screen. Preserve all unrelated content and visual decisions from the current screen.',
      'The original invitation context below remains authoritative. Apply the new edit without replacing or contradicting it.',
      'Keep the result as a complete static HTML document. Do not add scripts, event handlers, forms, external fonts, frameworks, remote stylesheets, or arbitrary third-party resources.',
      'Keep edits focused on visual design and user-requested invitation content. Never add or modify RSVP sections, forms, buttons, controls, or logic, countdown timers or displays, authentication, billing, or credits. RSVP remains a separate SaaS-rendered component outside this document.',
      'ORIGINAL INVITATION CONTEXT:',
      event.description?.trim() || `${event.eventType}: ${event.title}`,
      `Event title: ${event.title}`,
      `Event type: ${event.eventType}`,
      `Date: ${event.eventDate}`,
      ...(event.startTime ? [`Start time: ${event.startTime}`] : []),
      ...(event.venueName ? [`Venue: ${event.venueName}`] : []),
      ...(event.venueAddress ? [`Venue address: ${event.venueAddress}`] : []),
      'NEW EDIT REQUEST:',
      instruction.trim(),
      ...(explicitImages.length
        ? [
            'EXPLICIT USER IMAGE REQUEST:',
            `The user explicitly selected ${explicitImages.length} private uploaded image(s): ${explicitImages.map((image) => image.fileName).join(', ')}. Make suitable placements for them. The application will securely bind the actual private images after this edit; do not invent URLs or visual details.`,
          ]
        : []),
    ].join('\n');
  }
}

export function normalizeStitchHtml(
  html: string,
  screenTitle: string | null,
  event: { title: string; eventDate: string; venueName: string | null }
): StitchNormalizedHtml {
  if (!html.trim()) throw new Error('empty-stitch-html');
  const titleFromDocument = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1];
  const title = plainText(titleFromDocument ?? screenTitle ?? event.title) || event.title;
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const descriptionMeta = metaTags.find((tag) => /\bname\s*=\s*["']description["']/i.test(tag));
  const description =
    (descriptionMeta && attribute(descriptionMeta, 'content')) ||
    [event.eventDate, event.venueName].filter(Boolean).join(' · ') ||
    title;
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean)
    .join('\n');
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  let body = bodyMatch?.[1] ?? html;
  if (!bodyMatch) {
    body = body
      .replace(/<!doctype[^>]*>/gi, '')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, '')
      .replace(/<html\b[^>]*>|<\/html\s*>/gi, '');
  }
  body = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  if (!body.trim()) throw new Error('empty-stitch-body');
  return { title, description, body, css };
}

function firstGeneratedScreen(value: unknown): JsonRecord | null {
  const root = record(value);
  if (!root) return null;
  if (downloadUrl(root.htmlCode)) return root;
  const candidates: JsonRecord[] = [];
  const components = Array.isArray(root.outputComponents) ? root.outputComponents : [];
  for (const component of components) {
    const design = record(record(component)?.design);
    const screens = Array.isArray(design?.screens) ? design.screens : [];
    for (const screen of screens) {
      const candidate = record(screen);
      if (candidate) candidates.push(candidate);
    }
  }
  const screens = Array.isArray(root.screens) ? root.screens : [];
  candidates.push(...screens.map(record).filter((screen): screen is JsonRecord => screen !== null));
  return (
    candidates.find((screen) => downloadUrl(screen.htmlCode) !== null) ??
    candidates.find((screen) => screen.screenType === 'DESIGN') ??
    null
  );
}

function generatedScreenId(screen: JsonRecord): string | null {
  const resourceName = firstString(screen, ['name']);
  const idFromName = resourceId(resourceName, 'screens');
  if (idFromName) return idFromName;
  return firstString(screen, ['screenId', 'id']);
}

function downloadUrl(value: unknown): string | null {
  if (typeof value === 'string') return value;
  const item = record(value);
  return item && typeof item.downloadUrl === 'string' ? item.downloadUrl : null;
}

function resourceId(value: string | null, resource: string): string | null {
  if (!value) return null;
  const match = new RegExp(`(?:^|/)${resource}/([^/]+)$`).exec(value);
  return match?.[1] ?? null;
}

function firstString(value: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const candidate = path
      .split('.')
      .reduce<unknown>((current, segment) => record(current)?.[segment], value);
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function responseShape(value: unknown): string[] {
  const shape: string[] = [];
  const visit = (current: unknown, path: string, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(current)) {
      shape.push(`${path}[${current.length}]`);
      current.slice(0, 3).forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }
    const item = record(current);
    if (!item) return;
    const keys = Object.keys(item).sort();
    shape.push(`${path}{${keys.join(',')}}`);
    for (const key of keys) {
      if (
        key === 'structuredContent' ||
        key === 'content' ||
        key === 'outputComponents' ||
        key === 'design' ||
        key === 'screens' ||
        key === 'htmlCode'
      ) {
        visit(item[key], path ? `${path}.${key}` : key, depth + 1);
      }
    }
  };
  visit(value, 'result', 0);
  return shape;
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function parseJson(text: string): JsonRecord {
  const parsed: unknown = JSON.parse(text);
  const value = record(parsed);
  if (!value) throw new Error('invalid-stitch-response');
  return value;
}

function parseSseJson(text: string): JsonRecord {
  const messages = text
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/).filter((line) => line.startsWith('data:')))
    .map((lines) => lines.map((line) => line.slice(5).trim()).join('\n'))
    .filter(Boolean);
  for (const message of messages.reverse()) {
    try {
      return parseJson(message);
    } catch {
      // Ignore non-JSON SSE events and inspect the next event.
    }
  }
  throw new Error('invalid-stitch-event-stream');
}

function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))?.[2] ?? null;
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
