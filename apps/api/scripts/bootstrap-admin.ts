import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/** One-time bootstrap for an installation with no administrator. */
async function main() {
  const prisma = new PrismaClient();
  const credentialPath = resolve(process.cwd(), '.env.admin.local');
  const email = 'admin@miad.local';

  try {
    if (existsSync(credentialPath)) {
      throw new Error('The local admin credential file already exists. No account was changed.');
    }
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    if (!adminRole) throw new Error('Admin role is missing. Run the database seed first.');

    const existingAdmin = await prisma.user.findFirst({ where: { roleId: adminRole.id } });
    if (existingAdmin) throw new Error('An admin account already exists. No account was changed.');
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail)
      throw new Error('The bootstrap email already exists. No account was changed.');

    const password = randomBytes(32).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 12);
    writeFileSync(credentialPath, `ADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });

    try {
      await prisma.user.create({
        data: {
          roleId: adminRole.id,
          firstName: 'Miad',
          lastName: 'Admin',
          email,
          passwordHash,
          isActive: true,
        },
      });
    } catch (error) {
      unlinkSync(credentialPath);
      throw error;
    }

    const created = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (
      !created ||
      created.role.name !== 'admin' ||
      !created.isActive ||
      !(await bcrypt.compare(password, created.passwordHash))
    ) {
      throw new Error('The account was created but verification failed.');
    }

    console.log(`Admin account ready: ${email}`);
    console.log(`Credentials saved at ${credentialPath} (owner readable only).`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin bootstrap failed.');
  process.exitCode = 1;
});
