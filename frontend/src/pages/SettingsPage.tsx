import { useEffect, useState } from 'react';
import { Eye, EyeOff, Check, X, Loader2, Save } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { settingsApi } from '../services/settingsApi';
import { cn } from '../lib/utils';

type SettingsState = Record<string, string>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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

  const saveSection = async (sectionName: string, keys: string[]) => {
    setSavingSection(sectionName);
    setSaveSuccess(null);
    try {
      for (const key of keys) {
        const value = settings[key];
        if (value && value !== '***CONFIGURED***' && value.trim() !== '') {
          await settingsApi.update(key, value);
        }
      }
      await fetchSettings();
      setSaveSuccess(sectionName);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (e) {
      console.error(`Erro ao salvar seção ${sectionName}`, e);
      alert(`Falha ao salvar configurações de ${sectionName}`);
    } finally {
      setSavingSection(null);
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

  const renderPasswordInput = (
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
      </div>
    );
  };

  const renderTextInput = (
    label: string,
    key: string,
    type: 'text' | 'number' | 'email' = 'text',
  ) => (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={settings[key] || ''}
        onChange={(e) => handleChange(key, e.target.value)}
        className={cn(
          'w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500',
          type === 'number' && 'w-32',
        )}
        min={type === 'number' ? '1' : undefined}
      />
    </div>
  );

  const renderSaveButton = (sectionName: string, keys: string[]) => (
    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
      <button
        onClick={() => void saveSection(sectionName, keys)}
        disabled={savingSection === sectionName}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {savingSection === sectionName ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Salvar Tudo
      </button>
      {saveSuccess === sectionName && (
        <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
          <Check className="w-4 h-4" /> Salvo com sucesso!
        </span>
      )}
    </div>
  );

  const mask = (val: string | undefined) => {
    if (!val || val === '***CONFIGURED***') return null;
    if (val.startsWith('***')) return val;
    return null;
  };

  const display = (val: string | undefined, fallback = 'Não configurado') => {
    if (!val) return fallback;
    if (val.startsWith('***')) return val;
    return val;
  };

  return (
    <Layout>
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">Configurações do Sistema</h2>

        <div className="space-y-8">
          {/* Telegram */}
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
              {renderPasswordInput(
                'Bot Token',
                'telegram_bot_token',
                showTelegramToken,
                setShowTelegramToken,
              )}
              {renderTextInput('Chat ID', 'telegram_chat_id')}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() =>
                  void saveSection('telegram', ['telegram_bot_token', 'telegram_chat_id'])
                }
                disabled={savingSection === 'telegram'}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {savingSection === 'telegram' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Tudo
              </button>
              <button
                onClick={() => void handleTestTelegram()}
                disabled={testStatus === 'loading'}
                className="flex items-center gap-2 px-4 py-2.5 font-medium text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
              >
                {testStatus === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Enviar Teste'
                )}
              </button>
              {saveSuccess === 'telegram' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <Check className="w-4 h-4" /> Salvo!
                </span>
              )}
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

          {/* Monitoramento */}
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
              <div className="flex flex-col gap-1 w-full">
                <label className="text-sm font-medium text-slate-700">
                  Remetentes monitorados (separados por virgula)
                </label>
                <textarea
                  value={settings['monitored_senders'] || ''}
                  onChange={(e) => handleChange('monitored_senders', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md p-3 text-sm focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                  placeholder="ex: contato@empresa.com, fiscal@dominio.com.br"
                />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <label className="text-sm font-medium text-slate-700">
                  Intervalo de Sincronizacao
                </label>
                <select
                  value={settings['sync_interval_hours'] || '4'}
                  onChange={(e) => handleChange('sync_interval_hours', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="1">1 hora</option>
                  <option value="2">2 horas</option>
                  <option value="4">4 horas</option>
                  <option value="8">8 horas</option>
                  <option value="12">12 horas</option>
                </select>
              </div>
            </div>

            {renderSaveButton('monitoramento', ['monitored_senders', 'sync_interval_hours'])}
          </section>

          {/* IMAP */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
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
              Conexao IMAP
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderTextInput('Host', 'imap_host')}
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Porta</label>
                  <label className="text-sm font-medium text-slate-600 flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings['imap_tls'] !== 'false'}
                      onChange={(e) =>
                        handleChange('imap_tls', e.target.checked ? 'true' : 'false')
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    TLS
                  </label>
                </div>
                <input
                  type="number"
                  value={settings['imap_port'] || '993'}
                  onChange={(e) => handleChange('imap_port', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                />
              </div>
              {renderTextInput('Usuario/Email', 'imap_user', 'email')}
              {renderPasswordInput('Senha', 'imap_password', showImapPassword, setShowImapPassword)}
            </div>

            {renderSaveButton('imap', [
              'imap_host',
              'imap_port',
              'imap_user',
              'imap_password',
              'imap_tls',
            ])}
          </section>

          {/* Resumo de Configuracoes */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-6 mb-12">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <span className="bg-slate-200 text-slate-700 p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </span>
              Resumo das Configuracoes Ativas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Telegram */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Telegram Alertas
                </h4>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Bot Token</dt>
                    <dd
                      className={cn(
                        'font-medium',
                        settings['telegram_bot_token'] ? 'text-slate-900' : 'text-red-500',
                      )}
                    >
                      {settings['telegram_bot_token']
                        ? mask(settings['telegram_bot_token']) ||
                          display(settings['telegram_bot_token'])
                        : 'Nao configurado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Chat ID</dt>
                    <dd
                      className={cn(
                        'font-medium',
                        settings['telegram_chat_id'] ? 'text-slate-900' : 'text-red-500',
                      )}
                    >
                      {display(settings['telegram_chat_id'], 'Nao configurado')}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Monitoramento */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Monitoramento
                </h4>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Remetentes</dt>
                    <dd
                      className={cn(
                        'font-medium',
                        settings['monitored_senders'] ? 'text-slate-900' : 'text-red-500',
                      )}
                    >
                      {settings['monitored_senders']
                        ? settings['monitored_senders']
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .join(', ')
                        : 'Nenhum configurado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Intervalo</dt>
                    <dd className="font-medium text-slate-900">
                      {settings['sync_interval_hours']
                        ? `A cada ${settings['sync_interval_hours']}h`
                        : 'A cada 4h (padrao)'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* IMAP */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Conexao IMAP
                </h4>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Servidor</dt>
                    <dd
                      className={cn(
                        'font-medium',
                        settings['imap_host'] ? 'text-slate-900' : 'text-red-500',
                      )}
                    >
                      {settings['imap_host']
                        ? `${settings['imap_host']}:${settings['imap_port'] || '993'} ${settings['imap_tls'] !== 'false' ? '(TLS)' : ''}`
                        : 'Nao configurado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Conta</dt>
                    <dd
                      className={cn(
                        'font-medium',
                        settings['imap_user'] ? 'text-slate-900' : 'text-red-500',
                      )}
                    >
                      {settings['imap_user']
                        ? settings['imap_user'].startsWith('***')
                          ? settings['imap_user']
                          : settings['imap_user']
                        : 'Nao configurado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Senha</dt>
                    <dd
                      className={cn(
                        'font-medium',
                        settings['imap_password'] ? 'text-slate-900' : 'text-red-500',
                      )}
                    >
                      {settings['imap_password'] ? '***CONFIGURED***' : 'Nao configurado'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
