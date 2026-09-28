import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnalyzeAiStudioDto } from './analyze-ai-studio.dto';

describe('AnalyzeAiStudioDto', () => {
  it('accepts and preserves multiple string answers, including a multi-select value', async () => {
    const dto = plainToInstance(AnalyzeAiStudioDto, {
      prompt: 'Create a wedding invitation for Ahmad and Sara.',
      answers: [
        { questionId: 'style', value: 'Luxury romantic' },
        { questionId: 'colors', value: ['Ivory', 'gold'] },
        { questionId: 'date', value: 'June 20, 2027' },
      ],
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.answers).toEqual([
      { questionId: 'style', value: 'Luxury romantic' },
      { questionId: 'colors', value: ['Ivory', 'gold'] },
      { questionId: 'date', value: 'June 20, 2027' },
    ]);
  });
});
