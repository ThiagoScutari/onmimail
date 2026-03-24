import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { settingsApi } from '../services/settingsApi';

/**
 * Extract the OAuth authorization code from the URL.
 *
 * Microsoft Azure AD returns the code in the query string (?code=xxx) when
 * response_mode=query, but when the redirect URI is registered as an SPA
 * platform type, Azure AD may override this and deliver the code in a URL
 * fragment (#code=xxx) instead.  We check both locations so the callback
 * works regardless of which mode Azure AD uses.
 */
function extractCodeFromUrl(searchParams: URLSearchParams): string | null {
  // 1. Check query string (?code=xxx) — standard for response_mode=query
  const fromQuery = searchParams.get('code');
  if (fromQuery) return fromQuery;

  // 2. Check URL hash fragment (#code=xxx) — Azure AD SPA redirect default
  const hash = window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash.substring(1));
    const fromHash = hashParams.get('code');
    if (fromHash) return fromHash;
  }

  return null;
}

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = useMemo(() => extractCodeFromUrl(searchParams), [searchParams]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(code ? 'loading' : 'error');
  const [errorMsg, setErrorMsg] = useState(
    code ? '' : 'Codigo de autorizacao nao encontrado na URL.',
  );

  useEffect(() => {
    if (!code) return;

    settingsApi
      .oauthCallback(code)
      .then((result) => {
        if (result && result.connected === false && result.error) {
          setStatus('error');
          setErrorMsg(result.error);
          return;
        }
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
