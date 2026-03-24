import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../components/Header';
import { emailApi } from '../services/emailApi';
import * as AuthContextModule from '../contexts/AuthContext';

vi.mock('../services/emailApi', () => ({
  emailApi: {
    syncEmails: vi.fn(),
  },
}));

vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
  user: { email: 'admin@omnimail.com' },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
});

const renderWithProviders = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Header', () => {
  it('botão sync chama POST /emails/sync', async () => {
    (emailApi.syncEmails as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      processed: 2,
    });
    renderWithProviders(<Header />);
    const syncBtn = screen.getByText(/sincronizar/i);
    await act(async () => {
      fireEvent.click(syncBtn);
    });
    expect(emailApi.syncEmails).toHaveBeenCalled();
  });

  it('link settings navega para /settings', () => {
    renderWithProviders(<Header />);
    const settingsLink = document.querySelector('a[href="/settings"]');
    expect(settingsLink).toBeInTheDocument();
  });
});
