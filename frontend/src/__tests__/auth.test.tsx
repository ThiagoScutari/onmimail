import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { PrivateRoute } from '../components/PrivateRoute';
import { Routes, Route } from 'react-router-dom';

// Mock axios
vi.mock('../services/api', () => {
  const mockApi: Record<string, unknown> = {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    defaults: { baseURL: 'http://localhost:3000' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return { default: mockApi };
});

import api from '../services/api';

// Helper: create a fake JWT token
function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

// Helper component to expose auth context in tests
function AuthStatus() {
  const { isAuthenticated, user, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </span>
      {user && <span data-testid="user-email">{user.email}</span>}
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('login com credenciais válidas armazena tokens e define user', async () => {
    const fakeToken = createFakeJwt({
      sub: 'user-123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { accessToken: fakeToken, refreshToken: 'refresh-abc' },
    });

    function LoginTrigger() {
      const { login } = useAuth();
      return <button onClick={() => login('test@example.com', 'password123')}>Login</button>;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginTrigger />
          <AuthStatus />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    expect(localStorage.getItem('accessToken')).toBe(fakeToken);
    expect(localStorage.getItem('refreshToken')).toBe('refresh-abc');
    expect(screen.getByTestId('user-email').textContent).toBe('test@example.com');
  });

  it('login com credenciais inválidas lança erro', async () => {
    const error = { response: { status: 401 } };
    vi.mocked(api.post).mockRejectedValueOnce(error);

    let loginError: unknown = null;

    function LoginTrigger() {
      const { login } = useAuth();
      return (
        <button
          onClick={async () => {
            try {
              await login('bad@email.com', 'wrong');
            } catch (e) {
              loginError = e;
            }
          }}
        >
          Login
        </button>
      );
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginTrigger />
          <AuthStatus />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(loginError).toBeTruthy();
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('not-authenticated');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('logout limpa tokens e estado', async () => {
    const fakeToken = createFakeJwt({
      sub: 'user-123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    localStorage.setItem('accessToken', fakeToken);
    localStorage.setItem('refreshToken', 'refresh-abc');

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    await userEvent.click(screen.getByText('Logout'));

    expect(screen.getByTestId('auth-status').textContent).toBe('not-authenticated');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('PrivateRoute redireciona para /login se não autenticado', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<PrivateRoute />}>
              <Route path="/dashboard" element={<div>Dashboard</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('PrivateRoute renderiza conteúdo se autenticado', () => {
    const fakeToken = createFakeJwt({
      sub: 'user-123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    localStorage.setItem('accessToken', fakeToken);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<PrivateRoute />}>
              <Route path="/dashboard" element={<div>Dashboard</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('token expirado no mount resulta em não autenticado', () => {
    const expiredToken = createFakeJwt({
      sub: 'user-123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) - 60, // expired 1 min ago
    });

    localStorage.setItem('accessToken', expiredToken);

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('auth-status').textContent).toBe('not-authenticated');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('login chama api.post com credenciais corretas', async () => {
    const fakeToken = createFakeJwt({
      sub: 'user-123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { accessToken: fakeToken, refreshToken: 'refresh-xyz' },
    });

    function LoginTrigger() {
      const { login } = useAuth();
      return <button onClick={() => login('user@test.com', 'pass123456')}>Login</button>;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginTrigger />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'user@test.com',
        password: 'pass123456',
      });
    });
  });
});
