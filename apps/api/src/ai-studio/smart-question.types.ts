/**
 * Smart Question Flow — strict structured data types.
 *
 * These are DATA shapes returned by the analysis model and validated by the
 * service. Question text and options are plain data only; the model can never
 * emit HTML or UI code here, and the service rejects anything malformed.
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

/** Validates a single option: non-empty label and value, sane lengths. */
function parseOption(value: unknown): SmartQuestionOption | null {
  if (!isPlainObject(value)) return null;
  const label = cleanString(value.label, MAX_LABEL);
  const rawValue = value.value === undefined ? value.label : value.value;
  const optionValue = cleanString(rawValue, MAX_VALUE);
  if (!label || !optionValue) return null;
  return { label, value: optionValue };
}

/**
 * Validates one question. Returns null for anything malformed (bad type,
 * missing text, empty options on a select, non-string option entries), so the
 * service can reject the whole model response safely.
 */
function parseQuestion(value: unknown): SmartQuestion | null {
  if (!isPlainObject(value)) return null;
  const id = cleanString(value.id, MAX_ID);
  const text = cleanString(value.text, MAX_TEXT);
  if (!id || !text) return null;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) return null;
  if (!SMART_QUESTION_TYPES.includes(value.type as SmartQuestionType)) return null;
  const type = value.type as SmartQuestionType;

  const rawOptions = value.options;
  const options: SmartQuestionOption[] = [];
  if (Array.isArray(rawOptions)) {
    for (const entry of rawOptions) {
      if (options.length >= MAX_OPTIONS) break;
      const option = parseOption(entry);
      if (option) options.push(option);
      else return null; // a malformed option invalidates the question
    }
  }
  // A select question must actually offer choices.
  if ((type === 'single_select' || type === 'multi_select') && options.length === 0) {
    return null;
  }
  // Free-form types must not ship options.
  if ((type === 'text' || type === 'date' || type === 'time') && options.length > 0) {
    return null;
  }
  const allowOther =
    (type === 'single_select' || type === 'multi_select') && value.allowOther !== false;
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

const STATUS_VALUES = ['READY', 'QUESTION'] as const;

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
  const direct = root.status;
  if (typeof direct === 'string') {
    const value = direct.trim().toUpperCase();
    if ((STATUS_VALUES as readonly string[]).includes(value)) {
      return value as 'READY' | 'QUESTION';
    }
  }
  for (const key of Object.keys(root)) {
    if (!/^status/i.test(key)) continue;
    const glued = key.slice('status'.length).trim().toUpperCase();
    if ((STATUS_VALUES as readonly string[]).includes(glued)) {
      return glued as 'READY' | 'QUESTION';
    }
  }
  return null;
}

/**
 * Strictly validates a raw model analysis response.
 * Returns a normalized analysis, or null when the response is malformed.
 * The model can only influence the question DATA here; nothing is rendered
 * as HTML and any unexpected shape is rejected outright.
 */
export function parseSmartAnalysis(value: unknown): SmartAnalysis | null {
  if (!isPlainObject(value)) return null;
  const status = readStatus(value);
  if (!status) return null;
  const collectedData = parseCollectedData(value.collectedData);

  if (status === 'READY') {
    return { status: 'READY', collectedData, question: null };
  }
  const question = parseQuestion(value.question);
  if (!question) return null;
  return { status: 'QUESTION', collectedData, question };
}
