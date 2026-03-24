import api from './api';
import type { Email, EmailDetail, EmailStatus, PaginatedResponse } from '../types/email';

export const emailApi = {
  getEmails: async (params?: {
    page?: number;
    limit?: number;
    status?: EmailStatus;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const response = await api.get<PaginatedResponse<Email>>('/emails', { params });
    return response.data;
  },
  getEmailById: async (id: string) => {
    const response = await api.get<EmailDetail>(`/emails/${id}`);
    return response.data;
  },
  updateStatus: async (id: string, status: EmailStatus) => {
    const response = await api.patch<{ id: string; status: EmailStatus; updatedAt: string }>(
      `/emails/${id}/status`,
      { status },
    );
    return response.data;
  },
  syncEmails: async () => {
    const response = await api.post<{ processed: number; message: string }>('/emails/sync');
    return response.data;
  },
};
