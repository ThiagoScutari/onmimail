import React, { useEffect } from 'react';
import { X, CheckCircle, MailCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useEmailDetail } from '../hooks/useEmailDetail';
import { emailApi } from '../services/emailApi';
import { StatusBadge } from './StatusBadge';

interface Props {
  id: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const EmailPreview: React.FC<Props> = ({ id, onClose, onUpdated }) => {
  const { data: email, isLoading } = useEmailDetail(id || '', !!id);

  // Marcar como lido automaticamente
  useEffect(() => {
    if (email && email.status === 'UNREAD') {
      emailApi.updateStatus(email.id, 'READ').then(() => onUpdated());
    }
  }, [email, onUpdated]);

  if (!id) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header Drawer */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Visualizar Mensagem</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading || !email ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">{email.subject}</h1>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">{email.from}</span>
                    <span>para {email.to || 'mim'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-sm text-slate-500">
                    {format(new Date(email.date), "dd 'de' MMM, HH:mm")}
                  </span>
                  <StatusBadge status={email.status} />
                </div>
              </div>

              <div className="w-full h-px bg-slate-100" />

              <div className="bg-slate-50 rounded-lg p-6 border border-slate-100 whitespace-pre-wrap text-slate-700 font-medium leading-relaxed">
                {email.body}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {email && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button
              onClick={() => {
                emailApi.updateStatus(email.id, 'READ').then(() => onUpdated());
              }}
              disabled={email.status === 'READ'}
              className="flex items-center gap-2 px-4 py-2 font-medium text-sm text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <MailCheck className="w-4 h-4" />
              Marcar como Lido
            </button>
            <button
              onClick={() => {
                emailApi.updateStatus(email.id, 'RESPONDED').then(() => {
                  onUpdated();
                  onClose();
                });
              }}
              disabled={email.status === 'RESPONDED'}
              className="flex items-center gap-2 px-4 py-2 font-medium text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Marcar como Respondido
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
