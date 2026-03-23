export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  hasAttachments: boolean;
}
