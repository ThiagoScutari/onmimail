/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPage from './SettingsPage';
import { settingsApi } from '../services/settingsApi';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';

vi.mock('../services/settingsApi', () => ({
  settingsApi: {
    getAll: vi.fn(),
    update: vi.fn(),
    testTelegram: vi.fn(),
    oauthStatus: vi.fn().mockResolvedValue({ connected: false, provider: 'microsoft' }),
    oauthAuthorize: vi.fn().mockResolvedValue({ url: 'https://login.microsoftonline.com/auth' }),
    oauthCallback: vi.fn().mockResolvedValue({ connected: true }),
    oauthDisconnect: vi.fn().mockResolvedValue({ disconnected: true }),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    (settingsApi.getAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      telegram_bot_token: '***CONFIGURED***',
      telegram_chat_id: '1113158400',
      monitored_senders: 'teste@teste.com',
      imap_host: 'outlook.office365.com',
    });
    (settingsApi.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('renderiza secoes e resumo apos loading', async () => {
    renderWithProviders(<SettingsPage />);
    const telegramHeaders = await screen.findAllByText('Telegram Alertas');
    expect(telegramHeaders.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Resumo das Configuracoes Ativas/i)).toBeInTheDocument();
  });

  it('exibe ***CONFIGURED*** quando valor e mascarado', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findAllByText('Telegram Alertas');
    expect(screen.getByDisplayValue('***CONFIGURED***')).toBeInTheDocument();
  });

  it('botao Enviar Teste chama endpoint correto', async () => {
    (settingsApi.testTelegram as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
    renderWithProviders(<SettingsPage />);
    await screen.findAllByText('Telegram Alertas');
    fireEvent.click(screen.getByText('Enviar Teste'));
    await waitFor(() => {
      expect(settingsApi.testTelegram).toHaveBeenCalled();
    });
  });

  it('Salvar Tudo nao envia campos mascarados', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findAllByText('Telegram Alertas');
    const buttons = screen.getAllByText('Salvar Tudo');
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(settingsApi.update).toHaveBeenCalledWith('telegram_chat_id', '1113158400');
      expect(settingsApi.update).not.toHaveBeenCalledWith('telegram_bot_token', '***CONFIGURED***');
    });
  });

  it('resumo exibe dados salvos', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findAllByText('Telegram Alertas');
    // Chat ID appears in form and summary
    expect(screen.getAllByText('1113158400').length).toBeGreaterThanOrEqual(1);
    // Monitored senders appears in textarea and summary
    expect(screen.getAllByText('teste@teste.com').length).toBeGreaterThanOrEqual(1);
    // Summary section exists
    expect(screen.getByText(/Resumo das Configuracoes Ativas/i)).toBeInTheDocument();
  });
});
