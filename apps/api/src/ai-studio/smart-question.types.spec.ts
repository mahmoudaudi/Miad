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

  it('keeps usable options and drops unusable option entries', () => {
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: question({ options: ['Luxury', 42] }) })
    ).toMatchObject({
      status: 'QUESTION',
      question: { options: [{ label: 'Luxury', value: 'Luxury' }] },
    });
  });

  it('drops malformed options while retaining choices the UI can render', () => {
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
    ).toMatchObject({
      status: 'QUESTION',
      question: { options: [{ label: 'B', value: 'B' }] },
    });
  });

  it('ignores irrelevant options on a free-form question', () => {
    expect(
      parseSmartAnalysis({
        status: 'QUESTION',
        question: question({ type: 'date', options: [{ label: 'A', value: 'A' }] }),
      })
    ).toMatchObject({ status: 'QUESTION', question: { type: 'date', options: [] } });
  });

  it('normalizes a malformed id and still requires usable question text', () => {
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: question({ id: '' }) })
    ).toMatchObject({
      status: 'QUESTION',
      question: { id: 'smart-question' },
    });
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: question({ id: 'Not Kebab' }) })
    ).toMatchObject({ status: 'QUESTION', question: { id: 'not-kebab' } });
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

  it('rejects a response with no supported status token', () => {
    expect(parseSmartAnalysis({ statusCode: 200, collectedData: {} })).toBeNull();
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

  it('ignores harmless extra fields in a valid response', () => {
    expect(
      parseSmartAnalysis({
        status: 'READY',
        collectedData: { eventType: 'Wedding' },
        confidence: 0.93,
        explanation: 'Enough details are present.',
        question: { unexpected: true },
      })
    ).toEqual({ status: 'READY', collectedData: { eventType: 'Wedding' }, question: null });
  });

  it('normalizes common field names, status aliases, and string choices', () => {
    expect(
      parseSmartAnalysis({
        state: 'ask',
        collected_data: { eventType: 'Dinner', ignored: { unsafe: true } },
        next_question: {
          questionId: 'event style',
          prompt: 'What style should the invitation use?',
          questionType: 'select',
          choices: ['Modern', 'Classic'],
          unrelated: 'ignored',
        },
      })
    ).toEqual({
      status: 'QUESTION',
      collectedData: { eventType: 'Dinner' },
      question: {
        id: 'event-style',
        text: 'What style should the invitation use?',
        type: 'single_select',
        options: [
          { label: 'Modern', value: 'Modern' },
          { label: 'Classic', value: 'Classic' },
        ],
        allowOther: false,
      },
    });
  });

  it('defaults absent optional question and brief fields safely', () => {
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: { text: 'What else matters?' } })
    ).toEqual({
      status: 'QUESTION',
      collectedData: {},
      question: {
        id: 'smart-question',
        text: 'What else matters?',
        type: 'text',
        options: [],
        allowOther: false,
      },
    });
  });

  it('rejects results that cannot be converted into a usable question', () => {
    expect(
      parseSmartAnalysis({
        status: 'QUESTION',
        question: { text: 'Choose one', type: 'single_select', options: [null, 42] },
      })
    ).toBeNull();
    expect(
      parseSmartAnalysis({ status: 'QUESTION', question: { text: 'Question?', type: 'slider' } })
    ).toBeNull();
    expect(parseSmartAnalysis({ status: '__proto__', question: question() })).toBeNull();
    expect(
      parseSmartAnalysis({
        status: 'QUESTION',
        question: { text: 'Question?', type: 'constructor' },
      })
    ).toBeNull();
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
