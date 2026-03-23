import api from './api';

export const settingsApi = {
  getAll: () => api.get<Record<string, string>>('/settings').then((r) => r.data),
  update: (key: string, value: string) =>
    api.put(`/settings/${key}`, { value }).then((r) => r.data),
  testTelegram: () => api.post('/settings/telegram/test').then((r) => r.data),
};
