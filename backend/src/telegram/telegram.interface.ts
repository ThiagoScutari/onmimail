export interface TelegramNotification {
  from: string;
  subject: string;
  date: string;
  emailId: string;
}

export interface TelegramServiceInterface {
  sendEmailAlert(notification: TelegramNotification): Promise<void>;
  sendStatusMessage(message: string): Promise<void>;
  isConfigured(): Promise<boolean>;
}
