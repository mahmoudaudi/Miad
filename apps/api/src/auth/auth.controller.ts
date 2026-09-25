import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ACCESS_COOKIE, AuthService, REFRESH_COOKIE, SafeUser, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentAuthUser, CurrentUser, AuthPayload } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const isProd = () => process.env.NODE_ENV === 'production';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  private setCookies(res: Response, tokens: TokenPair) {
    const accessTtl = this.parseTtl(
      this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      15 * 60 * 1000
    );
    const refreshTtl = this.parseTtl(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
      30 * 24 * 60 * 60 * 1000
    );
    const base = { httpOnly: true, secure: isProd(), sameSite: 'lax' as const, path: '/' };
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: accessTtl });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: refreshTtl });
  }

  private clearCookies(res: Response) {
    const base = { httpOnly: true, secure: isProd(), sameSite: 'lax' as const, path: '/' };
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }

  private parseTtl(raw: string, fallbackMs: number): number {
    const m = /^(\d+)([smhd])$/.exec(raw.trim());
    if (!m || !m[1] || !m[2]) return fallbackMs;
    const n = Number(m[1]);
    const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return n * (mult[m[2]] ?? 60000);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.register(dto);
    this.setCookies(res, tokens);
    return user;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(dto);
    this.setCookies(res, tokens);
    return user;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get('google')
  google(@Res() res: Response) {
    const state = this.signOAuthState(randomBytes(24).toString('hex'));
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/v1/auth',
    });
    return res.redirect(this.auth.googleAuthorizationUrl(state));
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const frontend = this.config.get<string>('frontendUrl') ?? 'http://localhost:3000';
    if (!code || !state || !this.validOAuthState(state, req.cookies?.oauth_state)) {
      return res.redirect(`${frontend}/login?oauth=error`);
    }
    try {
      const { tokens } = await this.auth.loginWithGoogle(code);
      this.setCookies(res, tokens);
      res.clearCookie('oauth_state', { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/api/v1/auth' });
      return res.redirect(`${frontend}/dashboard/invitations/new`);
    } catch {
      return res.redirect(`${frontend}/login?oauth=error`);
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { user, tokens } = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE] ?? '');
      this.setCookies(res, tokens);
      return user;
    } catch (error) {
      // Invalid, expired, or reused refresh credentials must not remain in
      // the browser and trigger repeated failed refresh attempts.
      this.clearCookies(res);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentUser() user: AuthPayload, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sub);
    this.clearCookies(res);
    return { status: 'ok' as const };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentAuthUser() user: SafeUser) {
    // Served from the guard's single user lookup — no second database query.
    return user;
  }

  private signOAuthState(nonce: string): string {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const signature = createHmac('sha256', secret).update(nonce).digest('hex');
    return `${nonce}.${signature}`;
  }

  private validOAuthState(value: string, expected: string | undefined): boolean {
    if (!expected || value !== expected) return false;
    const [nonce, signature] = value.split('.');
    if (!nonce || !signature) return false;
    const expectedSignature = createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET')).update(nonce).digest('hex');
    return signature.length === expectedSignature.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}
