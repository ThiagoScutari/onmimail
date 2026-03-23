import { useEffect, useState } from 'react';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { settingsApi } from '../services/settingsApi';
import { cn } from '../lib/utils';

type SettingsState = Record<string, string>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({});
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Visibility toggles for passwords
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);

  useEffect(() => {
    fetchSettings().catch(console.error);
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await settingsApi.getAll();
      setSettings(data);
    } catch (e) {
      console.error('Falha ao carregar configuracoes', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (key: string, value: string) => {
    if (value === '***CONFIGURED***') return;

    try {
      setSavingField(key);
      await settingsApi.update(key, value);
      await fetchSettings();
    } catch (e) {
      console.error(`Erro ao salvar ${key}`, e);
      alert(`Falha ao salvar ${key}`);
    } finally {
      setSavingField(null);
    }
  };

  const handleTestTelegram = async () => {
    try {
      setTestStatus('loading');
      await settingsApi.testTelegram();
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (e) {
      console.error('Falha ao enviar teste telegram', e);
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 4000);
    }
  };

  const handleChange = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  if (loading) {
    return (
      <Layout>
        <Header />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  const renderPasswordField = (
    label: string,
    key: string,
    show: boolean,
    setShow: (s: boolean) => void,
  ) => {
    const val = settings[key] || '';
    return (
      <div className="flex flex-col gap-1 w-full">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="relative flex">
          <input
            type={show ? 'text' : 'password'}
            value={val}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-md py-2 pl-3 pr-10 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex justify-end mt-1">
          <button
            onClick={() => void handleUpdate(key, settings[key] || '')}
            disabled={savingField === key || val === '***CONFIGURED***' || !val}
            className="flex items-center justify-center h-8 px-4 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingField === key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : 'Salvar'}
          </button>
        </div>
      </div>
    );
  };

  const renderTextField = (
    label: string,
    key: string,
    type: 'text' | 'number' | 'email' = 'text',
  ) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={settings[key] || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className={cn(
              'flex-1 bg-white border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500',
              type === 'number' && 'w-24 flex-none',
            )}
            min={type === 'number' ? '1' : undefined}
          />
          <button
            onClick={() => void handleUpdate(key, settings[key] || '')}
            disabled={savingField === key || !settings[key]}
            className="flex items-center justify-center h-9 px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingField === key ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">Configurações do Sistema</h2>

        <div className="space-y-8">
          {/* Section 1: Telegram */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </span>
              Telegram Alertas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderPasswordField(
                'Bot Token',
                'telegram_bot_token',
                showTelegramToken,
                setShowTelegramToken,
              )}
              {renderTextField('Chat ID', 'telegram_chat_id')}
            </div>

            <div className="mt-6 flex items-center gap-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => void handleTestTelegram()}
                disabled={testStatus === 'loading'}
                className="flex items-center gap-2 px-4 py-2 font-medium text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition disabled:opacity-50"
              >
                {testStatus === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Enviar Teste'
                )}
              </button>

              {testStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <Check className="w-4 h-4" /> Mensagem enviada!
                </span>
              )}
              {testStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
                  <X className="w-4 h-4" /> Falha no envio
                </span>
              )}
            </div>
          </section>

          {/* Section 2: Monitoramento */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </span>
              Regras de Monitoramento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1 w-full relative">
                <label className="text-sm font-medium text-slate-700">
                  Remetentes monitorados (um por linha)
                </label>
                <textarea
                  value={settings['monitored_senders'] || ''}
                  onChange={(e) => handleChange('monitored_senders', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md p-3 text-sm focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                  placeholder="ex: contato@.com&#10;@dominio.com.br"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() =>
                      void handleUpdate('monitored_senders', settings['monitored_senders'] || '')
                    }
                    disabled={savingField === 'monitored_senders'}
                    className="flex items-center justify-center h-8 px-4 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingField === 'monitored_senders' ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      'Salvar'
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="text-sm font-medium text-slate-700">
                  Intervalo de Sincronização
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={settings['sync_interval_hours'] || '1'}
                    onChange={(e) => handleChange('sync_interval_hours', e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1">1 hora</option>
                    <option value="2">2 horas</option>
                    <option value="4">4 horas</option>
                    <option value="8">8 horas</option>
                    <option value="12">12 horas</option>
                  </select>
                  <button
                    onClick={() =>
                      void handleUpdate(
                        'sync_interval_hours',
                        settings['sync_interval_hours'] || '1',
                      )
                    }
                    disabled={savingField === 'sync_interval_hours'}
                    className="flex items-center justify-center h-9 w-20 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingField === 'sync_interval_hours' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Salvar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: IMAP */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-12 relative">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </span>
              Conexão IMAP
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {renderTextField('Host', 'imap_host')}
              <div className="flex flex-col gap-1 w-full relative">
                {renderTextField('Porta', 'imap_port', 'number')}
                <div className="absolute top-1 right-2 flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600 flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings['imap_tls'] === 'true'}
                      onChange={(e) => {
                        const val = e.target.checked ? 'true' : 'false';
                        handleChange('imap_tls', val);
                        void handleUpdate('imap_tls', val);
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    TLS
                  </label>
                </div>
              </div>
              {renderTextField('Usuário/Email', 'imap_user', 'email')}
              {renderPasswordField('Senha', 'imap_password', showImapPassword, setShowImapPassword)}
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
