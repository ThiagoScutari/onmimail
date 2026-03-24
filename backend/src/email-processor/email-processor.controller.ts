import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailProcessorService } from './email-processor.service';
import { ImapService } from '../imap/imap.service';

@Controller('emails')
export class EmailProcessorController {
  constructor(
    private readonly emailProcessorService: EmailProcessorService,
    private readonly imapService: ImapService,
  ) {}

  @Get('folders')
  @UseGuards(JwtAuthGuard)
  async listFolders(): Promise<{ folders: string[] }> {
    try {
      const folders = await this.imapService.listFolders();
      return { folders };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao listar pastas';
      return { folders: [`Erro: ${message}`] };
    }
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async sync(): Promise<{
    processed: number;
    message: string;
    error?: string;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const senders = await this.emailProcessorService.getMonitoredSenders();

      const processed = await this.emailProcessorService.processNewEmails(
        since,
        senders,
      );

      return {
        processed,
        message: `Sync concluído: ${processed} novos e-mails processados`,
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro desconhecido na sincronização';
      return { processed: 0, message, error: message };
    }
  }
}
