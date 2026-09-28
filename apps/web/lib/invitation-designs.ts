import { authenticatedApiClient } from './api-client';

export const invitationThemeIds = [
  'classic-ivory',
  'modern-contrast',
  'romantic-blush',
  'midnight-onyx',
  'sage-garden',
  'ocean-pearl',
  'terracotta-fiesta',
  'lavender-mist',
  'emerald-evening',
] as const;

export type InvitationThemeId = (typeof invitationThemeIds)[number];
export type InvitationFontFamily = 'Playfair Display' | 'Inter';
export type InvitationAlignment = 'center' | 'left';
export type InvitationDensity = 'airy' | 'compact';

/** Deterministic hero presentations. Absent = centered (legacy look). */
export const heroSectionVariants = ['centered', 'split', 'overlay', 'minimal'] as const;

export type HeroSectionVariant = (typeof heroSectionVariants)[number];

export function heroVariantOf(variant: unknown): HeroSectionVariant {
  return (heroSectionVariants as readonly string[]).includes(variant as string)
    ? (variant as HeroSectionVariant)
    : 'centered';
}

export type InvitationSection = {
  id: string;
  type: 'hero' | 'details' | 'story' | 'schedule' | 'rsvp' | 'note';
  title: string;
  body: string;
  order: number;
  visible: boolean;
  variant?: string;
};

export type InvitationElement = {
  id: string;
  type: 'text' | 'image' | 'section';
  label: string;
  text?: string;
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  backgroundColor?: string;
};

export type InvitationDesignSpecification = {
  schemaVersion: 1;
  theme: InvitationThemeId;
  content: { eyebrow: string; title: string; dateLine: string; venueLine: string };
  colors: { background: string; surface: string; text: string; accent: string };
  typography: {
    headingFamily: InvitationFontFamily;
    bodyFamily: InvitationFontFamily;
  };
  layout: { alignment: InvitationAlignment; density: InvitationDensity };
  sections?: InvitationSection[];
  elements?: InvitationElement[];
};

export type InvitationDesignRecord = {
  id: string;
  invitationId: string;
  version: number;
  designSpecification: InvitationDesignSpecification;
  sourceType: string;
  isActive: boolean;
  createdAt: string;
};

export type HtmlDesignArtifact = {
  format: 'html';
  version: 1;
  title: string;
  description: string;
  body: string;
  css: string;
};

export type GeneratedWebsiteProject = {
  name: string;
  description: string;
  files: Array<{ path: 'index.html' | 'styles.css'; content: string }>;
};

export type InvitationHtmlDesignRecord = {
  id: string;
  invitationId: string;
  version: number;
  artifact: HtmlDesignArtifact;
  project: GeneratedWebsiteProject;
  sourceType: string;
  isActive: boolean;
  createdAt: string;
};

export type InvitationDesignResponse = InvitationDesignRecord | InvitationHtmlDesignRecord;

export type InvitationDesignOption = {
  id: InvitationThemeId;
  name: string;
  description: string;
  specification: InvitationDesignSpecification;
};

const sampleContent: InvitationDesignSpecification['content'] = {
  eyebrow: 'You are invited',
  title: 'A Beautiful Occasion',
  dateLine: 'Saturday · Six in the evening',
  venueLine: 'The Garden Room',
};

export const invitationDesignOptions: readonly InvitationDesignOption[] = [
  {
    id: 'classic-ivory',
    name: 'Classic Ivory',
    description: 'Warm ivory, refined serif headings, and centered composition.',
    specification: {
      schemaVersion: 1,
      theme: 'classic-ivory',
      content: sampleContent,
      colors: {
        background: '#FFFDF8',
        surface: '#FFFFFF',
        text: '#241C18',
        accent: '#8B7355',
      },
      typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
      layout: { alignment: 'center', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'modern-contrast',
    name: 'Modern Contrast',
    description: 'Crisp typography, strong contrast, and a left-aligned layout.',
    specification: {
      schemaVersion: 1,
      theme: 'modern-contrast',
      content: sampleContent,
      colors: {
        background: '#F7F4F1',
        surface: '#FFFFFF',
        text: '#171717',
        accent: '#7A263A',
      },
      typography: { headingFamily: 'Inter', bodyFamily: 'Inter' },
      layout: { alignment: 'left', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'romantic-blush',
    name: 'Romantic Blush',
    description: 'Soft blush tones, editorial serif type, and centered details.',
    specification: {
      schemaVersion: 1,
      theme: 'romantic-blush',
      content: sampleContent,
      colors: {
        background: '#FFF7F8',
        surface: '#FFFFFF',
        text: '#3A2026',
        accent: '#A45C6A',
      },
      typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
      layout: { alignment: 'center', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'midnight-onyx',
    name: 'Midnight Onyx',
    description: 'Dramatic dark canvas with gold accents for evening affairs.',
    specification: {
      schemaVersion: 1,
      theme: 'midnight-onyx',
      content: sampleContent,
      colors: {
        background: '#141210',
        surface: '#1E1B17',
        text: '#F2EDE4',
        accent: '#C9A227',
      },
      typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
      layout: { alignment: 'center', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'sage-garden',
    name: 'Sage Garden',
    description: 'Calm botanical greens on a soft natural ground.',
    specification: {
      schemaVersion: 1,
      theme: 'sage-garden',
      content: sampleContent,
      colors: {
        background: '#EDF2E9',
        surface: '#FFFFFF',
        text: '#2E3A2C',
        accent: '#5F7A54',
      },
      typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
      layout: { alignment: 'center', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'ocean-pearl',
    name: 'Ocean Pearl',
    description: 'Crisp coastal blues with a clean left-aligned layout.',
    specification: {
      schemaVersion: 1,
      theme: 'ocean-pearl',
      content: sampleContent,
      colors: {
        background: '#EAF1F6',
        surface: '#FFFFFF',
        text: '#22333F',
        accent: '#3E7CB1',
      },
      typography: { headingFamily: 'Inter', bodyFamily: 'Inter' },
      layout: { alignment: 'left', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'terracotta-fiesta',
    name: 'Terracotta Fiesta',
    description: 'Warm clay tones for joyful sunlit gatherings.',
    specification: {
      schemaVersion: 1,
      theme: 'terracotta-fiesta',
      content: sampleContent,
      colors: {
        background: '#FBF1E6',
        surface: '#FFFFFF',
        text: '#4A2E1E',
        accent: '#C05621',
      },
      typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
      layout: { alignment: 'center', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    description: 'Dreamy violet-grey tones with an editorial feel.',
    specification: {
      schemaVersion: 1,
      theme: 'lavender-mist',
      content: sampleContent,
      colors: {
        background: '#F1EDF7',
        surface: '#FFFFFF',
        text: '#37314A',
        accent: '#7C6AAE',
      },
      typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
      layout: { alignment: 'center', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
  {
    id: 'emerald-evening',
    name: 'Emerald Evening',
    description: 'Deep jewel greens for formal after-dark events.',
    specification: {
      schemaVersion: 1,
      theme: 'emerald-evening',
      content: sampleContent,
      colors: {
        background: '#10201A',
        surface: '#16291F',
        text: '#EDF5EE',
        accent: '#3FA37A',
      },
      typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
      layout: { alignment: 'center', density: 'airy' },
      sections: [],
      elements: [],
    },
  },
] as const;

export function defaultSections(
  specification: Pick<InvitationDesignSpecification, 'content'>
): InvitationSection[] {
  const { content } = specification;
  return [
    {
      id: 'hero',
      type: 'hero',
      title: content.title,
      body: content.eyebrow,
      order: 0,
      visible: true,
    },
    {
      id: 'details',
      type: 'details',
      title: 'Details',
      body: `${content.dateLine} at ${content.venueLine}`,
      order: 1,
      visible: true,
    },
    {
      id: 'story',
      type: 'story',
      title: 'A note for guests',
      body: 'Join us for a memorable celebration with the people who matter most.',
      order: 2,
      visible: true,
    },
  ];
}

export function defaultElements(
  specification: Pick<InvitationDesignSpecification, 'content' | 'colors' | 'layout'>
): InvitationElement[] {
  const { content, colors, layout } = specification;
  return [
    {
      id: 'eyebrow',
      type: 'text',
      label: 'Eyebrow',
      text: content.eyebrow,
      x: layout.alignment === 'center' ? 20 : 10,
      y: 12,
      width: 60,
      height: 8,
      fontSize: 13,
      color: colors.accent,
    },
    {
      id: 'title',
      type: 'text',
      label: 'Title',
      text: content.title,
      x: layout.alignment === 'center' ? 12 : 10,
      y: 25,
      width: 76,
      height: 20,
      fontSize: 48,
      color: colors.text,
    },
    {
      id: 'details',
      type: 'section',
      label: 'Details',
      text: `${content.dateLine}\n${content.venueLine}`,
      x: layout.alignment === 'center' ? 22 : 10,
      y: 58,
      width: 56,
      height: 18,
      fontSize: 16,
      color: colors.text,
    },
    {
      id: 'image',
      type: 'image',
      label: 'Image',
      x: 66,
      y: 10,
      width: 24,
      height: 28,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
  ];
}

export function completeInvitationSpecification(
  specification: InvitationDesignSpecification
): InvitationDesignSpecification & {
  sections: InvitationSection[];
  elements: InvitationElement[];
} {
  const sections = specification.sections?.length
    ? specification.sections
    : defaultSections(specification);
  const elements = specification.elements?.length
    ? specification.elements
    : defaultElements(specification);
  return { ...specification, sections, elements };
}

export function applyInvitationTheme(
  current: InvitationDesignSpecification,
  theme: InvitationThemeId
): InvitationDesignSpecification {
  const option = invitationDesignOptions.find((candidate) => candidate.id === theme);
  if (!option) return current;
  return {
    ...option.specification,
    content: current.content,
    colors: { ...option.specification.colors },
    typography: { ...option.specification.typography },
    layout: { ...option.specification.layout },
    sections: current.sections?.length ? current.sections : defaultSections(current),
    elements: current.elements?.length ? current.elements : defaultElements(current),
  };
}

export const designSpecificationsMatch = (
  left: InvitationDesignSpecification,
  right: InvitationDesignSpecification
) => JSON.stringify(left) === JSON.stringify(right);

export const getInvitationDesign = (invitationId: string) =>
  authenticatedApiClient<{ design: InvitationDesignResponse | null }>(
    `/invitations/${invitationId}/design`
  );

export const createInvitationDesign = (invitationId: string, theme: InvitationThemeId) =>
  authenticatedApiClient<InvitationDesignRecord>(`/invitations/${invitationId}/design`, {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });

export const updateInvitationDesign = (invitationId: string, theme: InvitationThemeId) =>
  authenticatedApiClient<InvitationDesignRecord>(`/invitations/${invitationId}/design`, {
    method: 'PATCH',
    body: JSON.stringify({ theme }),
  });

export const saveInvitationEditor = (
  invitationId: string,
  specification: InvitationDesignSpecification
) =>
  authenticatedApiClient<InvitationDesignRecord>(`/invitations/${invitationId}/design`, {
    method: 'PATCH',
    body: JSON.stringify({
      theme: specification.theme,
      content: specification.content,
      colors: specification.colors,
      typography: specification.typography,
      layout: specification.layout,
      sections: specification.sections,
      elements: specification.elements,
    }),
  });

export const generateInvitationDesign = (
  invitationId: string,
  input: { prompt: string; mode?: 'generate' | 'regenerate'; modelPreference?: 'auto' | string },
  signal?: AbortSignal
) =>
  authenticatedApiClient<InvitationDesignRecord>(
    `/invitations/${invitationId}/design/ai/generate`,
    {
      method: 'POST',
      body: JSON.stringify(input),
      ...(signal ? { signal } : {}),
    }
  );

export const refineInvitationDesign = (
  invitationId: string,
  instruction: string,
  modelPreference: 'auto' | string = 'auto',
  signal?: AbortSignal
) =>
  authenticatedApiClient<InvitationDesignRecord>(`/invitations/${invitationId}/design/ai/refine`, {
    method: 'POST',
    body: JSON.stringify({ instruction, modelPreference }),
    ...(signal ? { signal } : {}),
  });

export const refineHtmlInvitationDesign = (invitationId: string, instruction: string) =>
  authenticatedApiClient<InvitationHtmlDesignRecord>(
    `/invitations/${invitationId}/design/ai/refine-html`,
    {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }
  );
