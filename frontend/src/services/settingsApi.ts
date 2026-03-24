import api from './api';

export const settingsApi = {
  getAll: () => api.get<Record<string, string>>('/settings').then((r) => r.data),
  update: (key: string, value: string) =>
    api.put(`/settings/${key}`, { value }).then((r) => r.data),
  testTelegram: () => api.post('/settings/telegram/test').then((r) => r.data),
  oauthAuthorize: (provider = 'microsoft') =>
    api.get<{ url: string }>(`/oauth/authorize?provider=${provider}`).then((r) => r.data),
  oauthCallback: (code: string, provider = 'microsoft') =>
    api
      .post<{ connected: boolean; error?: string }>('/oauth/callback', { code, provider })
      .then((r) => r.data),
  oauthStatus: (provider = 'microsoft') =>
    api
      .get<{ connected: boolean; provider: string }>(`/oauth/status?provider=${provider}`)
      .then((r) => r.data),
  oauthDisconnect: (provider = 'microsoft') =>
    api.post<{ disconnected: boolean }>('/oauth/disconnect', { provider }).then((r) => r.data),
};
