import React, { useState } from 'react';
import { RefreshCcw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { emailApi } from '../services/emailApi';

export const Header: React.FC = () => {
  const { logout } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await emailApi.syncEmails();
    } catch (e) {
      console.error(e);
    } finally {
      // Small timeout to show rotation
      setTimeout(() => setSyncing(false), 500);
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 rounded p-1.5 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Omnimail</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </header>
  );
};
