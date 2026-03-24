import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmailPreview } from '../components/EmailPreview';
import { emailApi } from '../services/emailApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../services/emailApi', () => ({
  emailApi: {
    getEmailById: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderCtx = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

describe('EmailPreview', () => {
  it('abre drawer com dados do email e chama updateStatus', async () => {
    (emailApi.getEmailById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '123',
      body: 'Corpo do email',
      status: 'UNREAD',
      from: 'sender',
      subject: 'hello',
      date: new Date().toISOString(),
      to: 'mim',
    });
    const updateSpy = (
      emailApi.updateStatus as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});

    renderCtx(<EmailPreview id="123" onClose={vi.fn()} onUpdated={vi.fn()} />);

    await screen.findByText('sender');

    await act(async () => {});
    expect(updateSpy).toHaveBeenCalledWith('123', 'READ');
  });
});
