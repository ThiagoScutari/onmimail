import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailProcessorService } from './email-processor.service';

@Controller('emails')
export class EmailProcessorController {
  constructor(private readonly emailProcessorService: EmailProcessorService) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async sync(): Promise<{ processed: number; message: string }> {
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
  }
}
