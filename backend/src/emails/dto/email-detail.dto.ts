import { ApiProperty } from '@nestjs/swagger';
import { EmailResponseDto } from './email-response.dto';

export class EmailDetailDto extends EmailResponseDto {
  @ApiProperty({ description: 'Destinatário (descriptografado)' })
  to!: string;

  @ApiProperty({ description: 'Corpo do e-mail (descriptografado)' })
  body!: string;
}
