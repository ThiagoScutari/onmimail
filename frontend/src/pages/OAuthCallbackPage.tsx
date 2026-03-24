import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { settingsApi } from '../services/settingsApi';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = useMemo(() => searchParams.get('code'), [searchParams]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(code ? 'loading' : 'error');
  const [errorMsg, setErrorMsg] = useState(
    code ? '' : 'Codigo de autorizacao nao encontrado na URL.',
  );

  useEffect(() => {
    if (!code) return;

    settingsApi
      .oauthCallback(code)
      .then(() => {
        setStatus('success');
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-callback', success: true }, '*');
          setTimeout(() => window.close(), 2000);
        } else {
          setTimeout(() => navigate('/settings'), 2000);
        }
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Falha ao conectar. Tente novamente.');
      });
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">Conectando conta...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-emerald-700 text-lg font-semibold">Conectado com sucesso!</p>
            <p className="text-slate-500 text-sm mt-2">
              {window.opener
                ? 'Esta janela sera fechada automaticamente...'
                : 'Redirecionando para configuracoes...'}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 text-lg font-semibold mb-2">Erro na conexao</p>
            <p className="text-slate-600 text-sm mb-4">{errorMsg}</p>
            <a
              href="/settings"
              className="inline-block px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
            >
              Voltar para Configuracoes
            </a>
          </>
        )}
      </div>
    </div>
  );
}
