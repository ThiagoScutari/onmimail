import { ApiProperty } from '@nestjs/swagger';
import { EmailStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ enum: EmailStatus })
  @IsEnum(EmailStatus)
  @IsNotEmpty()
  status!: EmailStatus;
}
