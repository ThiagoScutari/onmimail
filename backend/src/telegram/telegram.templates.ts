import { TelegramNotification } from './telegram.service';

export function formatNewEmailAlert(
  notification: TelegramNotification,
): string {
  return `🔴 *URGENTE — Novo E-mail Contábil*

*De:* ${notification.from}
*Assunto:* ${notification.subject}
*Recebido:* ${notification.date}

▶ [Abrir no Painel](http://localhost:5173/dashboard)`;
}

export function formatStatusMessage(stats: {
  total: number;
  unread: number;
  read: number;
  responded: number;
}): string {
  const dataSync = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  return `📊 *Omnimail — Resumo*

📨 Total: ${stats.total} e-mails
🔴 Não lidos: ${stats.unread}
📖 Lidos: ${stats.read}
✅ Respondidos: ${stats.responded}

⏰ Última sincronização: ${dataSync}`;
}

export function formatGenericStatusMessage(message: string): string {
  const dataSync = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  return `ℹ️ *Omnimail — Status*

${message}

⏰ Última verificação: ${dataSync}`;
}
