import React from 'react';
import type { Email } from '../types/email';
import { EmailRow } from './EmailRow';

interface Props {
  emails: Email[];
  isLoading: boolean;
  onSelect: (id: string) => void;
}

export const EmailList: React.FC<Props> = ({ emails, isLoading, onSelect }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <svg
          className="w-12 h-12 mb-4 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p>Nenhum e-mail encontrado na sincronização atual.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-3 w-32">Status</th>
              <th className="px-6 py-3">Remetente</th>
              <th className="px-6 py-3 w-full">Assunto</th>
              <th className="px-6 py-3 w-40">Data</th>
              <th className="px-6 py-3 w-16 text-center">Anexos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {emails.map((e) => (
              <EmailRow key={e.id} email={e} onClick={() => onSelect(e.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
