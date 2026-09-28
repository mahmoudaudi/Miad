/**
 * Smart Question Flow — normalized types returned by the analysis parser.
 *
 * Model output is data only. Common shape variations are normalized, unusable
 * optional values are dropped, and the parser rejects responses the UI cannot
 * safely render. Question text and options are never treated as markup.
 */

export const SMART_QUESTION_TYPES = [
  'single_select',
  'multi_select',
  'text',
  'date',
  'time',
] as const;

export type SmartQuestionType = (typeof SMART_QUESTION_TYPES)[number];

export type SmartQuestionOption = {
  label: string;
  value: string;
};

export type SmartQuestion = {
  id: string;
  text: string;
  type: SmartQuestionType;
  options: SmartQuestionOption[];
  allowOther: boolean;
};

/**
 * Everything known so far, merged from the original prompt, prior AI
 * extraction, and the user's answers. Every field is optional; this is a
 * best-effort brief, not a completed form.
 */
export type SmartCollectedData = {
  eventType?: string;
  title?: string;
  names?: string[];
  date?: string;
  time?: string;
  location?: string;
  venue?: string;
  style?: string;
  colors?: string[];
  tone?: string;
  message?: string;
  rsvpRequired?: boolean;
  [key: string]: unknown;
};

export type SmartAnswerValue = string | string[] | null;

export type SmartAnswer = {
  questionId: string;
  value: SmartAnswerValue;
};

export type SmartAnalysis =
  | { status: 'READY'; collectedData: SmartCollectedData; question: null }
  | { status: 'QUESTION'; collectedData: SmartCollectedData; question: SmartQuestion };

const MAX_ID = 64;
const MAX_TEXT = 300;
const MAX_LABEL = 80;
const MAX_VALUE = 120;
const MAX_OPTIONS = 6;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Converts common option shapes into the small shape rendered by the UI. */
function normalizeOption(value: unknown): SmartQuestionOption | null {
  const source =
    typeof value === 'string' ? { label: value, value } : isPlainObject(value) ? value : null;
  if (!source) return null;
  const label = cleanString(source.label ?? source.title ?? source.name, MAX_LABEL);
  const rawValue = source.value ?? source.id ?? source.key ?? label;
  const optionValue = cleanString(rawValue, MAX_VALUE);
  if (!label || !optionValue) return null;
  return { label, value: optionValue };
}

function normalizeQuestionType(value: unknown, hasOptions: boolean): SmartQuestionType | null {
  if (value === undefined || value === null || value === '') {
    return hasOptions ? 'single_select' : 'text';
  }
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const aliases: Record<string, SmartQuestionType> = {
    single_select: 'single_select',
    select: 'single_select',
    dropdown: 'single_select',
    multi_select: 'multi_select',
    multiselect: 'multi_select',
    text: 'text',
    free_text: 'text',
    short_text: 'text',
    date: 'date',
    time: 'time',
  };
  return Object.prototype.hasOwnProperty.call(aliases, normalized)
    ? (aliases[normalized] ?? null)
    : null;
}

/** Normalizes common model variations, then validates what the UI needs. */
function normalizeQuestion(value: unknown): SmartQuestion | null {
  if (!isPlainObject(value)) return null;
  const rawOptions = value.options ?? value.choices;
  const hasOptions = Array.isArray(rawOptions) && rawOptions.length > 0;
  const type = normalizeQuestionType(
    value.type ?? value.questionType ?? value.inputType,
    hasOptions
  );
  const text = cleanString(
    value.text ?? value.prompt ?? value.questionText ?? value.label,
    MAX_TEXT
  );
  if (!type || !text) return null;

  const rawId = cleanString(value.id ?? value.questionId ?? value.key, MAX_ID);
  const id =
    (rawId ?? 'smart-question')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_ID) || 'smart-question';

  const options: SmartQuestionOption[] = [];
  if ((type === 'single_select' || type === 'multi_select') && Array.isArray(rawOptions)) {
    for (const entry of rawOptions) {
      if (options.length >= MAX_OPTIONS) break;
      const option = normalizeOption(entry);
      if (option && !options.some((existing) => existing.value === option.value)) {
        options.push(option);
      }
    }
  }
  // A select question needs at least one usable choice for the UI to render.
  if ((type === 'single_select' || type === 'multi_select') && options.length === 0) {
    return null;
  }
  const allowOtherValue = value.allowOther ?? value.allow_other;
  const allowOther =
    (type === 'single_select' || type === 'multi_select') && allowOtherValue === true;
  return { id, text, type, options, allowOther };
}

/** Validates and clamps the collected-data brief. */
function parseCollectedData(value: unknown): SmartCollectedData {
  if (!isPlainObject(value)) return {};
  const out: SmartCollectedData = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    if (key === 'names' || key === 'colors') {
      if (!Array.isArray(raw)) continue;
      const list = raw
        .map((item) => cleanString(item, MAX_LABEL))
        .filter((item): item is string => Boolean(item));
      if (list.length) out[key] = list;
      continue;
    }
    if (key === 'rsvpRequired') {
      if (typeof raw === 'boolean') out.rsvpRequired = raw;
      continue;
    }
    const cleaned = cleanString(raw, MAX_TEXT);
    if (cleaned) out[key] = cleaned;
  }
  return out;
}

const STATUS_ALIASES: Record<string, 'READY' | 'QUESTION'> = {
  READY: 'READY',
  COMPLETE: 'READY',
  COMPLETED: 'READY',
  QUESTION: 'QUESTION',
  ASK: 'QUESTION',
};

/**
 * Reads the analysis status.
 *
 * The model occasionally glues the status value onto the key name and emits
 * `{"statusREADY": ...}` instead of `{"status":"READY"}`. The token it actually
 * wrote is still the real answer, so it is read from the key rather than
 * discarding an otherwise complete brief. Anything without a recognisable
 * status token is still rejected.
 */
function readStatus(root: Record<string, unknown>): 'READY' | 'QUESTION' | null {
  const direct = root.status ?? root.state;
  if (typeof direct === 'string') {
    const value = direct.trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(STATUS_ALIASES, value)
      ? (STATUS_ALIASES[value] ?? null)
      : null;
  }
  for (const key of Object.keys(root)) {
    if (!/^status/i.test(key)) continue;
    const glued = key.slice('status'.length).trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(STATUS_ALIASES, glued)) {
      return STATUS_ALIASES[glued] ?? null;
    }
  }
  return null;
}

/**
 * Normalizes a parsed model analysis into the UI contract, returning null only
 * when the decision or required question content cannot be safely recovered.
 * Extra fields are ignored and all user-facing values remain bounded strings.
 */
export function parseSmartAnalysis(value: unknown): SmartAnalysis | null {
  if (!isPlainObject(value)) return null;
  const status = readStatus(value);
  if (!status) return null;
  const collectedData = parseCollectedData(value.collectedData ?? value.collected_data);

  if (status === 'READY') {
    return { status: 'READY', collectedData, question: null };
  }
  const rawQuestion = value.question ?? value.nextQuestion ?? value.next_question;
  const question = normalizeQuestion(
    typeof rawQuestion === 'string' ? { ...value, text: rawQuestion } : rawQuestion
  );
  if (!question) return null;
  return { status: 'QUESTION', collectedData, question };
}
