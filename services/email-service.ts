import { Result } from "../shared/result";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailContent {
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface EmailService {
  send(recipient: EmailRecipient, content: EmailContent): Promise<Result<void>>;
  sendBulk(
    recipients: EmailRecipient[],
    content: EmailContent,
  ): Promise<Result<void>>;
}
