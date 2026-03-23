import { useState } from 'react';
import { Header } from '../components/Header';
import { Layout } from '../components/Layout';
import { EmailList } from '../components/EmailList';
import { EmailPreview } from '../components/EmailPreview';
import { Pagination } from '../components/Pagination';
import { useEmails } from '../hooks/useEmails';
import type { EmailStatus } from '../types/email';

export default function DashboardPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<EmailStatus | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const limit = 20;
  const { data, isLoading, refetch } = useEmails(page, limit, statusFilter);

  return (
    <Layout>
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Caixa de Entrada Contábil</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Filtrar:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as EmailStatus);
                setPage(1);
              }}
              className="bg-white border border-slate-200 text-slate-700 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block px-3 py-1.5 shadow-sm"
            >
              <option value="">Todos</option>
              <option value="UNREAD">Não Lidos</option>
              <option value="READ">Lidos</option>
              <option value="RESPONDED">Respondidos</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <EmailList
          emails={data?.data || []}
          isLoading={isLoading}
          onSelect={(id) => setSelectedId(id)}
        />

        {data?.meta && data.meta.totalPages > 1 && (
          <Pagination page={page} totalPages={data.meta.totalPages} setPage={setPage} />
        )}
      </main>

      <EmailPreview id={selectedId} onClose={() => setSelectedId(null)} onUpdated={refetch} />
    </Layout>
  );
}
