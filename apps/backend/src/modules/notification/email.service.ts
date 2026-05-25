import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private isConfigured = false;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey && apiKey !== 'your-sendgrid-api-key') {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      this.logger.log('SendGrid configured successfully');
    } else {
      this.logger.warn('SendGrid API key not configured. Email sending disabled.');
    }
  }

  async sendWelcomeEmail(to: string, name: string) {
    if (!this.isConfigured) {
      this.logger.warn(`Email would be sent to ${to} but SendGrid not configured`);
      return;
    }

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@dakastore.com',
      subject: 'Selamat Datang di Daka Store Yogyakarta!',
      templateId: 'd-welcome-template', // Replace with actual template ID
      dynamicTemplateData: {
        name,
        loginUrl: `${process.env.FRONTEND_URL}/login`,
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #8B5CF6;">Selamat Datang, ${name}!</h1>
          <p>Terima kasih telah bergabung dengan Daka Store Yogyakarta.</p>
          <p>Nikmati pengalaman berbelanja dengan berbagai promo menarik!</p>
          <a href="${process.env.FRONTEND_URL}/login" style="background-color: #8B5CF6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Mulai Belanja
          </a>
          <hr style="margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Daka Store Yogyakarta - Marketplace #1 di Jogja</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Welcome email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}: ${error.message}`);
    }
  }

  async sendOrderNotificationEmail(to: string, orderId: string, role: 'buyer' | 'seller') {
    if (!this.isConfigured) {
      this.logger.warn(`Email would be sent to ${to} but SendGrid not configured`);
      return;
    }

    const subject =
      role === 'seller'
        ? `Pesanan Baru #${orderId} - Daka Store`
        : `Konfirmasi Pesanan #${orderId} - Daka Store`;

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@dakastore.com',
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #8B5CF6;">Daka Store Yogyakarta</h1>
          <h2>${role === 'seller' ? 'Pesanan Baru!' : 'Pesanan Dikonfirmasi'}</h2>
          <p>Order ID: <strong>${orderId}</strong></p>
          <a href="${process.env.FRONTEND_URL}/orders/${orderId}" style="background-color: #8B5CF6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Lihat Detail Pesanan
          </a>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Order notification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send order email to ${to}: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string) {
    if (!this.isConfigured) {
      this.logger.warn(`Email would be sent to ${to} but SendGrid not configured`);
      return;
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@dakastore.com',
      subject: 'Reset Password - Daka Store',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #8B5CF6;">Reset Password</h1>
          <p>Klik link di bawah ini untuk mereset password Anda:</p>
          <a href="${resetUrl}" style="background-color: #8B5CF6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
          <p>Link ini berlaku selama 1 jam.</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${error.message}`);
    }
  }
}
