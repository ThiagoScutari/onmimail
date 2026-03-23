import { Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailProcessorService } from './email-processor.service';

@Controller('emails')
export class EmailProcessorController {
  constructor(
    private readonly emailProcessorService: EmailProcessorService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async sync(): Promise<{ processed: number; message: string }> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const sendersConfig =
      this.configService.get<string>('MONITORED_SENDERS') ?? '';
    const senders = sendersConfig
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const processed = await this.emailProcessorService.processNewEmails(
      since,
      senders,
    );

    return {
      processed,
      message: `Sync concluído: ${processed} novos e-mails processados`,
    };
  }
}
