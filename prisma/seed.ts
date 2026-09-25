import { Prisma, PrismaClient } from '@prisma/client';

type SeedTemplate = {
  slug: string;
  name: string;
  description: string;
  category: string;
  sortOrder: number;
  specification: Prisma.InputJsonValue;
};

function templateSpec({
  theme,
  eyebrow,
  title,
  dateLine,
  venueLine,
  colors,
  headingFamily,
  alignment,
}: {
  theme: 'classic-ivory' | 'modern-contrast' | 'romantic-blush';
  eyebrow: string;
  title: string;
  dateLine: string;
  venueLine: string;
  colors: { background: string; surface: string; text: string; accent: string };
  headingFamily: 'Playfair Display' | 'Inter';
  alignment: 'center' | 'left';
}): Prisma.InputJsonValue {
  return {
    schemaVersion: 1,
    theme,
    content: { eyebrow, title, dateLine, venueLine },
    colors,
    typography: { headingFamily, bodyFamily: 'Inter' },
    layout: { alignment, density: 'airy' },
  };
}

/**
 * Invitation template catalog shown on the landing page. Safe to re-run
 * (upserts by slug) and intentionally database-backed, not a web mock list.
 */
const templateSeed = [
  {
    slug: 'deep-orange',
    name: 'Deep Orange',
    description: 'A bold music showcase invitation with saturated orange, black stage energy, and editorial type.',
    category: 'birthday',
    sortOrder: 1,
    specification: templateSpec({
      theme: 'modern-contrast',
      eyebrow: 'Live set invitation',
      title: 'Deep Orange',
      dateLine: 'Friday · 9:00 PM',
      venueLine: 'The Black Room',
      colors: { background: '#E02B11', surface: '#160301', text: '#FFFFFF', accent: '#FFB199' },
      headingFamily: 'Inter',
      alignment: 'center',
    }),
  },
  {
    slug: 'audio-matrix',
    name: 'Audio Matrix',
    description: 'A technical launch-party invitation with synth controls, neon meters, and a dark digital grid.',
    category: 'corporate',
    sortOrder: 2,
    specification: templateSpec({
      theme: 'modern-contrast',
      eyebrow: 'Product audio lab',
      title: 'Signal Night',
      dateLine: 'Thursday · 7:30 PM',
      venueLine: 'Studio 04',
      colors: { background: '#0D0F12', surface: '#14171D', text: '#D7FBE8', accent: '#34D399' },
      headingFamily: 'Inter',
      alignment: 'left',
    }),
  },
  {
    slug: 'spring-care',
    name: 'Spring Care',
    description: 'A polished clinic open-house invitation with fresh orange accents and clean dashboard rhythm.',
    category: 'corporate',
    sortOrder: 3,
    specification: templateSpec({
      theme: 'modern-contrast',
      eyebrow: 'Healthcare open house',
      title: 'Spring Care',
      dateLine: 'Tuesday · 10:00 AM',
      venueLine: 'Wellness Center',
      colors: { background: '#FFFFFF', surface: '#FFF4EE', text: '#17191D', accent: '#FF5A1F' },
      headingFamily: 'Inter',
      alignment: 'left',
    }),
  },
  {
    slug: 'dinner-party',
    name: 'The Dinner Party',
    description: 'A refined private dinner invitation with botanical greens, serif typography, and formal framing.',
    category: 'dinner',
    sortOrder: 4,
    specification: templateSpec({
      theme: 'classic-ivory',
      eyebrow: 'Exclusive gathering',
      title: 'The Dinner Party',
      dateLine: 'Saturday · 8:00 PM',
      venueLine: 'The Garden Room',
      colors: { background: '#EEF1E9', surface: '#FAF8F4', text: '#1B3425', accent: '#2B4C39' },
      headingFamily: 'Playfair Display',
      alignment: 'center',
    }),
  },
  {
    slug: 'altitude',
    name: 'Altitude Habitat',
    description: 'A premium retreat invitation with dark atmospheric panels and warm amber field notes.',
    category: 'corporate',
    sortOrder: 5,
    specification: templateSpec({
      theme: 'modern-contrast',
      eyebrow: 'Executive retreat',
      title: 'Altitude Habitat',
      dateLine: 'Friday · 4:00 PM',
      venueLine: 'Cloudline Lodge',
      colors: { background: '#18191C', surface: '#26272B', text: '#F5F0E6', accent: '#F2C879' },
      headingFamily: 'Inter',
      alignment: 'left',
    }),
  },
  {
    slug: 'jazz-night',
    name: 'Jazz Night',
    description: 'A lively birthday or club-night invitation with poster typography and monochrome rhythm.',
    category: 'birthday',
    sortOrder: 6,
    specification: templateSpec({
      theme: 'modern-contrast',
      eyebrow: 'Birthday session',
      title: 'Jazz Night',
      dateLine: 'Saturday · 8:00 PM',
      venueLine: 'Downtown Club',
      colors: { background: '#FBF9F4', surface: '#FFFFFF', text: '#000000', accent: '#7A263A' },
      headingFamily: 'Inter',
      alignment: 'center',
    }),
  },
  {
    slug: 'omakase',
    name: 'Omakase',
    description: 'An intimate chef-led dinner invitation with soft neutrals, Japanese accents, and elegant spacing.',
    category: 'dinner',
    sortOrder: 7,
    specification: templateSpec({
      theme: 'romantic-blush',
      eyebrow: 'Chef-led evening',
      title: 'Omakase',
      dateLine: 'Sunday · 7:00 PM',
      venueLine: 'Kai Counter',
      colors: { background: '#FBFAF8', surface: '#FFFFFF', text: '#2C2926', accent: '#B83B26' },
      headingFamily: 'Playfair Display',
      alignment: 'center',
    }),
  },
  {
    slug: 'silent-earth',
    name: 'The Silent Earth',
    description: 'A gallery-style wedding invitation with dramatic black tones, editorial serif type, and quiet luxury.',
    category: 'wedding',
    sortOrder: 8,
    specification: templateSpec({
      theme: 'modern-contrast',
      eyebrow: 'Gallery wedding',
      title: 'The Silent Earth',
      dateLine: 'Saturday · 5:30 PM',
      venueLine: 'Yosemite Valley',
      colors: { background: '#101114', surface: '#1D1F24', text: '#FFFFFF', accent: '#B8B8B8' },
      headingFamily: 'Playfair Display',
      alignment: 'left',
    }),
  },
] satisfies SeedTemplate[];

const inactiveLegacyTemplateSlugs = [
  'classic-ivory',
  'modern-contrast',
  'romantic-blush',
  'verify-birthday-probe',
];

/** Seed baseline RBAC roles. Safe to re-run (upserts). */
async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: { name: 'user', description: 'Regular platform user' },
    });
    await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin', description: 'Platform administrator' },
    });
    console.log('Seeded roles: user, admin');

    for (const template of templateSeed) {
      await prisma.template.upsert({
        where: { slug: template.slug },
        update: {
          name: template.name,
          description: template.description,
          category: template.category,
          specification: template.specification,
          sortOrder: template.sortOrder,
          isActive: true,
        },
        create: { ...template, isActive: true },
      });
    }
    await prisma.template.updateMany({
      where: { slug: { in: inactiveLegacyTemplateSlugs } },
      data: { isActive: false },
    });
    console.log(`Seeded templates: ${templateSeed.map((t) => t.slug).join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
