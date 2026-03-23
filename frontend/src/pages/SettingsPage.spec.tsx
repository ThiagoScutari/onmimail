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
      monitored_senders: 'teste@teste.com',
    });
    (settingsApi.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('renderiza seções principais após loading', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Telegram Alertas')).toBeInTheDocument();
    expect(screen.getByText('Regras de Monitoramento')).toBeInTheDocument();
    expect(screen.getByText('Conexão IMAP')).toBeInTheDocument();
  });

  it('exibe ***CONFIGURED*** quando valor é retornado', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByDisplayValue('***CONFIGURED***')).toBeInTheDocument();
  });

  it('botão Enviar Teste chama endpoint correto', async () => {
    (settingsApi.testTelegram as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
    renderWithProviders(<SettingsPage />);

    await screen.findByText('Telegram Alertas');
    fireEvent.click(screen.getByText('Enviar Teste'));

    await waitFor(() => {
      expect(settingsApi.testTelegram).toHaveBeenCalled();
    });
  });

  it('não envia dados se estiver ***CONFIGURED***', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Telegram Alertas');

    const buttons = screen.getAllByText('Salvar');
    fireEvent.click(buttons[0]);

    expect(settingsApi.update).not.toHaveBeenCalled();
  });

  it('salva valor após digitação não vazia', async () => {
    renderWithProviders(<SettingsPage />);
    const textarea = await screen.findByDisplayValue('teste@teste.com');
    fireEvent.change(textarea, { target: { value: 'novo@teste.com' } });

    // Clica em todos os botões salvar que não estiverem desabilitados
    const buttons = await screen.findAllByText('Salvar');
    for (const btn of buttons) {
      if (!(btn as HTMLButtonElement).disabled) {
        fireEvent.click(btn);
      }
    }

    await waitFor(() => {
      expect(settingsApi.update).toHaveBeenCalled();
    });
  });
});
