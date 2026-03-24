import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from '../components/Pagination';

describe('Pagination', () => {
  it('navega entre páginas', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} setPage={onPageChange} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('desabilita botão quando na última página', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={5} totalPages={5} setPage={onPageChange} />);

    const nextBtn = document.querySelectorAll('button')[1];
    expect(nextBtn.disabled).toBe(true);
  });
});
