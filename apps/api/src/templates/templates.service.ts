import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const templateSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  category: true,
  specification: true,
  createdAt: true,
} satisfies Prisma.TemplateSelect;

type TemplateResult = Prisma.TemplateGetPayload<{ select: typeof templateSelect }>;

export type TemplateResponse = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  specification: Prisma.JsonValue;
  createdAt: string;
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public catalog: active templates only, in display order. */
  async list(): Promise<TemplateResponse[]> {
    const rows = await this.prisma.template.findMany({
      where: { isActive: true },
      select: templateSelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  private toResponse(row: TemplateResult): TemplateResponse {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
      specification: row.specification,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
