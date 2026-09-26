import { parseSmartAnalysis, SMART_QUESTION_TYPES } from './smart-question.types';

const question = (overrides: Record<string, unknown> = {}) => ({
  id: 'event-style',
  text: 'What visual style would you like?',
  type: 'single_select',
  options: [
    { label: 'Luxury', value: 'Luxury' },
    { label: 'Modern', value: 'Modern' },
  ],
  allowOther: true,
  ...overrides,
});

describe('parseSmartAnalysis', () => {
  it('accepts a single_select question with real options', () => {
    const analysis = parseSmartAnalysis({
      status: 'QUESTION',
      question: question(),
      collectedData: { eventType: 'Wedding' },
    });
    expect(analysis).toEqual({
      status: 'QUESTION',
      question: {
        id: 'event-style',
        text: 'What visual style would you like?',
        type: 'single_select',
        options: [
          { label: 'Luxury', value: 'Luxury' },
          { label: 'Modern', value: 'Modern' },
        ],
        allowOther: true,
      },
      collectedData: { eventType: 'Wedding' },
    });
  });

  it('accepts multi_select, text, date, and time question types', () => {
    for (const type of SMART_QUESTION_TYPES) {
      const options =
        type === 'single_select' || type === 'multi_select'
          ? [
              { label: 'A', value: 'A' },
              { label: 'B', value: 'B' },
            ]
          : [];
      const analysis = parseSmartAnalysis({
        status: 'QUESTION',
        question: question({ type, options }),
      });
      expect(analysis?.status).toBe('QUESTION');
      if (analysis?.status === 'QUESTION') expect(analysis.question.type).toBe(type);
    }
  });

  it('rejects an unknown question type', () => {
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: question({ type: 'slider' }) })
    ).toBeNull();
  });

  it('rejects a select question with no options', () => {
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: question({ options: [] }) })
    ).toBeNull();
  });

  it('rejects options that are not well-formed objects', () => {
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: question({ options: ['Luxury', 42] }) })
    ).toBeNull();
  });

  it('rejects options missing a usable label', () => {
    expect(
      parseSmartAnalysis({
        status: 'QUESTION',
        question: question({
          options: [
            { label: '   ', value: 'Luxury' },
            { label: 'B', value: 'B' },
          ],
        }),
      })
    ).toBeNull();
  });

  it('rejects a free-form question that ships options', () => {
    expect(
      parseSmartAnalysis({
        status: 'QUESTION',
        question: question({ type: 'date', options: [{ label: 'A', value: 'A' }] }),
      })
    ).toBeNull();
  });

  it('rejects a question with a missing or malformed id or text', () => {
    expect(parseSmartAnalysis({ status: 'QUESTION', question: question({ id: '' }) })).toBeNull();
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: question({ id: 'Not Kebab' }) })
    ).toBeNull();
    expect(parseSmartAnalysis({ status: 'QUESTION', question: question({ text: '' }) })).toBeNull();
    expect(parseSmartAnalysis({ status: 'QUESTION', collectedData: {} })).toBeNull();
  });

  it('rejects a malformed analysis envelope', () => {
    expect(parseSmartAnalysis(null)).toBeNull();
    expect(parseSmartAnalysis('READY')).toBeNull();
    expect(parseSmartAnalysis({ status: 'MAYBE', collectedData: {} })).toBeNull();
    expect(parseSmartAnalysis({ collectedData: {} })).toBeNull();
  });

  it('reads a status the model glued onto the key name instead of discarding a complete brief', () => {
    // Observed from the live provider: {"statusREADY": …, "collectedData": {…}}.
    const analysis = parseSmartAnalysis({
      statusREADY: true,
      collectedData: {
        coupleNames: 'Ahmad and Sara',
        date: 'December 20, 2026',
        venue: 'The Garden Ballroom',
        city: 'Beirut',
      },
    });
    expect(analysis).toEqual({
      status: 'READY',
      question: null,
      collectedData: {
        coupleNames: 'Ahmad and Sara',
        date: 'December 20, 2026',
        venue: 'The Garden Ballroom',
        city: 'Beirut',
      },
    });
  });

  it('reads a glued QUESTION status and still validates the question', () => {
    const analysis = parseSmartAnalysis({
      statusQUESTION: true,
      collectedData: { eventType: 'wedding' },
      question: question({ id: 'atmosphere', type: 'single_select' }),
    });
    expect(analysis?.status).toBe('QUESTION');
  });

  it('accepts a normal status in any casing or surrounding whitespace', () => {
    expect(parseSmartAnalysis({ status: ' ready ', collectedData: {} })?.status).toBe('READY');
    expect(parseSmartAnalysis({ status: 'QUESTION', question: question() })?.status).toBe(
      'QUESTION'
    );
  });

  it('still rejects a response with no recognisable status token', () => {
    expect(parseSmartAnalysis({ statusCode: 200, collectedData: {} })).toBeNull();
    expect(parseSmartAnalysis({ state: 'READY', collectedData: {} })).toBeNull();
    expect(parseSmartAnalysis({ status: '', collectedData: {} })).toBeNull();
    expect(parseSmartAnalysis({ status: 'DONE', collectedData: {} })).toBeNull();
  });

  it('tolerates casing in a glued status token but still requires the real token', () => {
    expect(parseSmartAnalysis({ statusReady: true, collectedData: {} })?.status).toBe('READY');
    expect(parseSmartAnalysis({ statusNext: true, collectedData: {} })).toBeNull();
  });

  it('accepts READY and never carries a question', () => {
    const analysis = parseSmartAnalysis({
      status: 'READY',
      collectedData: { eventType: 'Wedding', names: ['Ahmad', 'Sara'], date: '2026-12-20' },
      question: question(),
    });
    expect(analysis).toEqual({
      status: 'READY',
      question: null,
      collectedData: { eventType: 'Wedding', names: ['Ahmad', 'Sara'], date: '2026-12-20' },
    });
  });

  it('clamps and drops unusable collected data instead of passing it through', () => {
    const analysis = parseSmartAnalysis({
      status: 'READY',
      collectedData: {
        eventType: 'Wedding',
        long: 'x'.repeat(500),
        rsvpRequired: true,
        names: ['Ahmad', '', 'Sara'],
        colors: 'not-an-array',
        style: '   ',
      },
    });
    expect(analysis?.status).toBe('READY');
    if (analysis?.status !== 'READY') return;
    expect(analysis.collectedData.eventType).toBe('Wedding');
    expect(analysis.collectedData.rsvpRequired).toBe(true);
    expect(analysis.collectedData.names).toEqual(['Ahmad', 'Sara']);
    // Non-array colors and blank style are dropped, never passed through.
    expect(analysis.collectedData.colors).toBeUndefined();
    expect(analysis.collectedData.style).toBeUndefined();
    expect(String(analysis.collectedData.long)).toHaveLength(300);
  });
});
