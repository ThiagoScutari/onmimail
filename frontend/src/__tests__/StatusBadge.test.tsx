import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '../components/StatusBadge';

describe('StatusBadge', () => {
  it('exibe cor vermelha para UNREAD', () => {
    render(<StatusBadge status="UNREAD" />);
    const span = screen.getByText('Não lido');
    expect(span.className).toContain('bg-red');
  });

  it('exibe cor cinza para READ', () => {
    render(<StatusBadge status="READ" />);
    const span = screen.getByText('Lido');
    expect(span.className).toContain('bg-slate');
  });

  it('exibe cor verde para RESPONDED', () => {
    render(<StatusBadge status="RESPONDED" />);
    const span = screen.getByText('Respondido');
    expect(span.className).toContain('bg-emerald');
  });
});
