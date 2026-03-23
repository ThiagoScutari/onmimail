import React from 'react';
import { format } from 'date-fns';
import { Paperclip } from 'lucide-react';
import type { Email } from '../types/email';
import { StatusBadge } from './StatusBadge';
import { cn } from '../lib/utils';

interface Props {
  email: Email;
  onClick: () => void;
}

export const EmailRow: React.FC<Props> = ({ email, onClick }) => {
  const isUnread = email.status === 'UNREAD';

  return (
    <tr
      onClick={onClick}
      className={cn(
        'cursor-pointer hover:bg-blue-50/50 transition-colors group',
        isUnread ? 'bg-blue-50/20' : 'bg-transparent',
      )}
    >
      <td className="px-6 py-4">
        <StatusBadge status={email.status} />
      </td>
      <td className="px-6 py-4 text-slate-800 font-medium">{email.from}</td>
      <td
        className={cn(
          'px-6 py-4 truncate max-w-md',
          isUnread ? 'text-slate-900 font-semibold' : 'text-slate-600',
        )}
      >
        {email.subject.length > 60 ? email.subject.substring(0, 60) + '...' : email.subject}
      </td>
      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
        {format(new Date(email.date), 'dd/MM/yyyy HH:mm')}
      </td>
      <td className="px-6 py-4 text-center">
        {email.hasAttachments && <Paperclip className="w-4 h-4 mx-auto text-slate-400" />}
      </td>
    </tr>
  );
};
