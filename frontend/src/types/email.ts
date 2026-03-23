export type EmailStatus = 'UNREAD' | 'READ' | 'RESPONDED';

export interface Email {
  id: string;
  from: string;
  subject: string;
  date: string;
  status: EmailStatus;
  hasAttachments: boolean;
  createdAt: string;
}

export interface EmailDetail extends Email {
  to: string;
  body: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
