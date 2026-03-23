import React from 'react';
import { cn } from '../lib/utils';
import type { EmailStatus } from '../types/email';

export const StatusBadge: React.FC<{ status: EmailStatus }> = ({ status }) => {
  const configsMenu = {
    UNREAD: { label: 'Não lido', className: 'bg-red-50 text-red-600 border-red-200' },
    READ: { label: 'Lido', className: 'bg-slate-50 text-slate-600 border-slate-200' },
    RESPONDED: {
      label: 'Respondido',
      className: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
  };
  const cfg = configsMenu[status] || configsMenu['UNREAD'];

  return (
    <span
      className={cn(
        'px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm transition-colors',
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
};
