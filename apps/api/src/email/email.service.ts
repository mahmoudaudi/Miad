import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtpHost');
    const port = this.config.get<number>('smtpPort');
    const user = this.config.get<string>('smtpUser');
    const pass = this.config.get<string>('smtpPass');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will not be sent.');
    }
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`Password reset email not sent to ${email} — SMTP not configured.`);
      return;
    }

    const from = this.config.get<string>('smtpFrom') ?? 'no-reply@miad.app';

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Reset your Miad password',
        text: `Click the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes.`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin-bottom: 16px;">Reset your Miad password</h2>
            <p style="color: #4a4a4a; margin-bottom: 24px;">Click the button below to reset your password. This link expires in 30 minutes.</p>
            <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Reset password</a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err instanceof Error ? err.stack : undefined);
    }
  }
}
