import { useQuery } from '@tanstack/react-query';
import { emailApi } from '../services/emailApi';
import type { EmailStatus } from '../types/email';

export const useEmails = (
  page: number,
  limit: number,
  status?: EmailStatus | '',
  dateFrom?: string,
  dateTo?: string,
) => {
  return useQuery({
    queryKey: ['emails', { page, limit, status, dateFrom, dateTo }],
    queryFn: () =>
      emailApi.getEmails({ page, limit, status: status || undefined, dateFrom, dateTo }),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
};
