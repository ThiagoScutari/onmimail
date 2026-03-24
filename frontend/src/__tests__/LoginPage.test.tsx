import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../pages/LoginPage';
import * as AuthContextModule from '../contexts/AuthContext';
import { AxiosError } from 'axios';
import { BrowserRouter } from 'react-router-dom';

const mockLogin = vi.fn();

vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: mockLogin,
  logout: vi.fn(),
});

const renderCtx = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('LoginPage', () => {
  it('submit chama api.post usando auth login', async () => {
    mockLogin.mockResolvedValue(true);
    renderCtx(<LoginPage />);

    const emailInput = screen.getByLabelText(/E-mail/i);
    const passInput = screen.getByLabelText(/Senha/i);

    fireEvent.change(emailInput, { target: { value: 'admin@omnimail.com' } });
    fireEvent.change(passInput, { target: { value: 'senha123' } });

    const submitBtn = screen.getByRole('button', { name: /entrar/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockLogin).toHaveBeenCalledWith('admin@omnimail.com', 'senha123');
  });

  it('erro 401 exibe mensagem', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = new AxiosError('mock', '401', undefined, {}, { status: 401 } as any);
    mockLogin.mockRejectedValue(err);
    renderCtx(<LoginPage />);

    const emailInput = screen.getByLabelText(/E-mail/i);
    const passInput = screen.getByLabelText(/Senha/i);

    fireEvent.change(emailInput, { target: { value: 'admin@omnimail.com' } });
    fireEvent.change(passInput, { target: { value: 'senhaerrada' } });

    const submitBtn = screen.getByRole('button', { name: /entrar/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    const assertText = screen.queryByText(/Credenciais inv/) || screen.queryByText(/Erro ao/);
    expect(assertText).toBeInTheDocument();
  });
});
