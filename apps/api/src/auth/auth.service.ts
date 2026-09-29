import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { FreeCreditsService } from '../billing/free-credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { notifyAdmins } from '../notifications/notifications.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
};

export type TokenPair = { accessToken: string; refreshToken: string };

type TokenPayload = { sub: string; email: string; role: string; v: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly freeCredits: FreeCreditsService
  ) {}

  private toSafeUser(u: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    role: { name: string };
  }): SafeUser {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role.name,
      isActive: u.isActive,
    };
  }

  private signPair(userId: string, email: string, role: string, tokenVersion: number): TokenPair {
    const payload = { sub: userId, email, role, v: tokenVersion };
    const accessTtl = (this.config.get<string>('JWT_ACCESS_TTL') ??
      '15m') as JwtSignOptions['expiresIn'];
    const refreshTtl = (this.config.get<string>('JWT_REFRESH_TTL') ??
      '30d') as JwtSignOptions['expiresIn'];
    return {
      accessToken: this.jwt.sign(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl,
      }),
      refreshToken: this.jwt.sign(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      }),
    };
  }

  async register(dto: RegisterDto): Promise<{ user: SafeUser; tokens: TokenPair }> {
    const email = dto.email.toLowerCase().trim();
    // Independent reads — issued together so they share one pooler roundtrip
    // instead of two sequential ones (~2s each against Supabase pooler).
    // Precedence is unchanged: the existence check is still evaluated first.
    const [existing, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.role.findUnique({ where: { name: 'user' } }),
    ]);
    if (existing) throw new ConflictException('An account with this email already exists.');
    if (!role) throw new ConflictException('Default role is not seeded.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          roleId: role.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          passwordHash,
          isActive: true,
        },
        include: { role: true },
      });
    } catch (error) {
      // The unique constraint is authoritative and closes the race between
      // the existence check above and the insert.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
    // Free plan welcome credits so a new account can try AI generation.
    // Best effort: never blocks registration, and the ledger key makes it
    // safe to retry.
    await this.freeCredits.grantFreeCreditsSafely(user.id, role.name);
    // Operational alerts are best effort; a notification outage must not block signup.
    try {
      await notifyAdmins(this.prisma, 'USER_REGISTERED', 'New user registered',
        `${user.firstName} ${user.lastName} (${user.email}) joined Miad.`);
    } catch {
      // The account is already created; the next activity can still notify admins.
    }
    return {
      user: this.toSafeUser(user),
      tokens: this.signPair(user.id, user.email, role.name, user.tokenVersion),
    };
  }

  async login(dto: LoginDto): Promise<{ user: SafeUser; tokens: TokenPair }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    // Generic message on purpose — never reveal whether the email exists.
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials.');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials.');
    return {
      user: this.toSafeUser(user),
      tokens: this.signPair(user.id, user.email, user.role.name, user.tokenVersion),
    };
  }

  async refresh(refreshToken: string): Promise<{ user: SafeUser; tokens: TokenPair }> {
    if (!refreshToken) throw new UnauthorizedException('Invalid session. Please log in again.');
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid session. Please log in again.');
    }

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.v !== 'number' ||
      !Number.isInteger(payload.v) ||
      payload.v < 0
    ) {
      throw new UnauthorizedException('Invalid session. Please log in again.');
    }

    // Atomic compare-and-swap rotation. Exactly one request can consume a
    // refresh token version; retries/reuse see count=0 and are rejected.
    const rotated = await this.prisma.user.updateMany({
      where: { id: payload.sub, isActive: true, tokenVersion: payload.v },
      data: { tokenVersion: { increment: 1 } },
    });
    if (rotated.count !== 1) throw new UnauthorizedException('Invalid session.');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || !user.isActive || user.tokenVersion !== payload.v + 1) {
      throw new UnauthorizedException('Invalid session.');
    }
    return {
      user: this.toSafeUser(user),
      tokens: this.signPair(user.id, user.email, user.role.name, user.tokenVersion),
    };
  }

  /** Bumps tokenVersion — instantly invalidates every issued token. */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async requestPasswordReset(emailInput: string): Promise<{ status: 'accepted' }> {
    const email = emailInput.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    // Deliberately identical for known and unknown addresses.
    if (!user) return { status: 'accepted' };

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const ttlMinutes = this.config.get<number>('passwordResetTtlMinutes') ?? 30;
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      }),
    ]);
    // Delivery is intentionally configuration-dependent. The raw token never
    // enters the HTTP response or logs; a mail provider must consume it here.
    const resetUrl = this.config.get<string>('passwordResetUrl');
    const webhookUrl = this.config.get<string>('passwordResetWebhookUrl');
    if (!resetUrl || !webhookUrl) throw new ServiceUnavailableException('Password reset delivery is not configured.');
    const delivery = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, resetUrl: `${resetUrl}?token=${encodeURIComponent(rawToken)}` }),
    });
    if (!delivery.ok) throw new ServiceUnavailableException('Password reset delivery is unavailable.');
    return { status: 'accepted' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ status: 'reset' }> {
    const tokenHash = this.hashResetToken(dto.token);
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const token = await transaction.passwordResetToken.findFirst({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        select: { id: true, userId: true },
      });
      if (!token) throw new UnauthorizedException('Invalid or expired reset token.');
      await transaction.user.update({
        where: { id: token.userId },
        data: { passwordHash: await bcrypt.hash(dto.password, 12), tokenVersion: { increment: 1 } },
      });
      await transaction.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: now } });
      await transaction.passwordResetToken.deleteMany({ where: { userId: token.userId, id: { not: token.id } } });
    });
    return { status: 'reset' };
  }

  googleAuthorizationUrl(state: string): string {
    const clientId = this.config.get<string>('googleClientId');
    const redirectUri = this.config.get<string>('googleRedirectUri');
    if (!clientId || !redirectUri) throw new ServiceUnavailableException('Google sign-in is not configured.');
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, access_type: 'online', prompt: 'select_account' });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async loginWithGoogle(code: string): Promise<{ user: SafeUser; tokens: TokenPair }> {
    const clientId = this.config.get<string>('googleClientId');
    const clientSecret = this.config.get<string>('googleClientSecret');
    const redirectUri = this.config.get<string>('googleRedirectUri');
    if (!clientId || !clientSecret || !redirectUri) throw new ServiceUnavailableException('Google sign-in is not configured.');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!tokenResponse.ok) throw new UnauthorizedException('Google sign-in could not be completed.');
    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenBody.access_token) throw new UnauthorizedException('Google sign-in could not be completed.');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenBody.access_token}` } });
    if (!profileResponse.ok) throw new UnauthorizedException('Google sign-in could not be completed.');
    const profile = (await profileResponse.json()) as { sub?: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string };
    if (!profile.sub || !profile.email || profile.email_verified !== true) throw new UnauthorizedException('Google account email could not be verified.');
    const email = profile.email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email }, include: { role: true } });
    const existingAccount = await this.prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.sub } }, include: { user: { include: { role: true } } } });
    user = existingAccount?.user ?? user;
    if (user && !user.isActive) {
      throw new UnauthorizedException('Google sign-in could not be completed.');
    }
    const isNewUser = !user;
    if (!user) {
      const role = await this.prisma.role.findUnique({ where: { name: 'user' } });
      if (!role) throw new ConflictException('Default role is not seeded.');
      user = await this.prisma.user.create({
        data: { roleId: role.id, firstName: profile.given_name?.slice(0, 100) || 'Google', lastName: profile.family_name?.slice(0, 100) || 'User', email, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12), isActive: true, oauthAccounts: { create: { provider: 'google', providerAccountId: profile.sub } } },
        include: { role: true },
      });
    } else if (!existingAccount) {
      await this.prisma.oAuthAccount.create({ data: { userId: user.id, provider: 'google', providerAccountId: profile.sub } });
    }
    // Same welcome grant for accounts created through Google sign-in.
    await this.freeCredits.grantFreeCreditsSafely(user.id, user.role.name);
    if (isNewUser) {
      try {
        await notifyAdmins(this.prisma, 'USER_REGISTERED', 'New user registered',
          `${user.firstName} ${user.lastName} (${user.email}) joined Miad.`);
      } catch {
        // A notification outage must not prevent the new account from signing in.
      }
    }
    return { user: this.toSafeUser(user), tokens: this.signPair(user.id, user.email, user.role.name, user.tokenVersion) };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
