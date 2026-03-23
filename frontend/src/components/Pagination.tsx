import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
}

export const Pagination: React.FC<Props> = ({ page, totalPages, setPage }) => {
  return (
    <div className="flex items-center justify-between mt-6 bg-white px-4 py-3 border border-slate-200 rounded-lg shadow-sm">
      <span className="text-sm text-slate-500 font-medium">
        Página <span className="text-slate-900">{page}</span> de{' '}
        <span className="text-slate-900">{totalPages || 1}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className={cn(
            'p-1.5 rounded border border-slate-200 transition-colors',
            page <= 1 ? 'text-slate-300 bg-slate-50' : 'text-slate-600 bg-white hover:bg-slate-100',
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'p-1.5 rounded border border-slate-200 transition-colors',
            page >= totalPages
              ? 'text-slate-300 bg-slate-50'
              : 'text-slate-600 bg-white hover:bg-slate-100',
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
