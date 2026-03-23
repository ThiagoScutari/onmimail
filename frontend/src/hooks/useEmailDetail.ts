import { useQuery } from '@tanstack/react-query';
import { emailApi } from '../services/emailApi';

export const useEmailDetail = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['email', id],
    queryFn: () => emailApi.getEmailById(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5,
  });
};
