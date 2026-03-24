import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmailList } from '../components/EmailList';

const mockEmails = [
  {
    id: '1',
    from: 'a@a.com',
    subject: 'Subject A',
    date: new Date().toISOString(),
    status: 'UNREAD' as const,
    hasAttachments: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    from: 'b@b.com',
    subject: 'Subject B',
    date: new Date().toISOString(),
    status: 'READ' as const,
    hasAttachments: true,
    createdAt: new Date().toISOString(),
  },
];

describe('EmailList', () => {
  it('renderiza lista de emails mockados', () => {
    const onSelect = vi.fn();
    render(<EmailList emails={mockEmails} isLoading={false} onSelect={onSelect} />);
    expect(screen.getByText('Subject A')).toBeInTheDocument();
    expect(screen.getByText('Subject B')).toBeInTheDocument();
  });

  it('chama onSelectEmail ao clicar no item', () => {
    const onSelect = vi.fn();
    render(<EmailList emails={mockEmails} isLoading={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Subject A'));
    expect(onSelect).toHaveBeenCalledWith(mockEmails[0].id);
  });
});
