import {
  EmailService,
  EmailRecipient,
  EmailContent,
} from "../../services/email-service";
import { Result, ok, err } from "../../shared/result";
import nodemailer from "nodemailer";

export interface NodemailerConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class NodemailerEmailService implements EmailService {
  private transporter: nodemailer.Transporter;
  private fromAddress: string;

  constructor(config: NodemailerConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
    this.fromAddress = config.from;
  }

  async send(
    recipient: EmailRecipient,
    content: EmailContent,
  ): Promise<Result<void>> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: recipient.email,
        subject: content.subject,
        text: !content.isHtml ? content.body : undefined,
        html: content.isHtml ? content.body : undefined,
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new Error(
          `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  async sendBulk(
    recipients: EmailRecipient[],
    content: EmailContent,
  ): Promise<Result<void>> {
    try {
      const promises = recipients.map((recipient) =>
        this.send(recipient, content),
      );

      await Promise.all(promises);
      return ok(undefined);
    } catch (error) {
      return err(
        new Error(
          `Failed to send bulk emails: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }
}
