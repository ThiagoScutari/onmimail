import { ApiProperty } from '@nestjs/swagger';
import { EmailStatus } from '@prisma/client';

export class EmailResponseDto {
  @ApiProperty({ description: 'UUID do e-mail no banco de dados' })
  id!: string;

  @ApiProperty({ description: 'Remetente (descriptografado)' })
  from!: string;

  @ApiProperty({ description: 'Assunto (descriptografado)' })
  subject!: string;

  @ApiProperty({ description: 'Data do recebimento formatada em ISO' })
  date!: string;

  @ApiProperty({
    enum: EmailStatus,
    description: 'Status de leitura do e-mail',
  })
  status!: EmailStatus;

  @ApiProperty({ description: 'Informa se há anexos na mensagem original' })
  hasAttachments!: boolean;

  @ApiProperty({ description: 'Data de criação do registro' })
  createdAt!: string;
}
