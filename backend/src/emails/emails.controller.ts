import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { EmailsService } from './emails.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { EmailResponseDto } from './dto/email-response.dto';
import { EmailDetailDto } from './dto/email-detail.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DecryptInterceptor } from '../crypto/decrypt.interceptor';

@ApiTags('emails')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emails')
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Get()
  @UseInterceptors(DecryptInterceptor)
  @ApiOperation({ summary: 'Listar e-mails com paginação e filtros' })
  @ApiResponse({
    status: 200,
    description: 'Retorna a lista de e-mails',
    type: [EmailResponseDto],
  })
  async findAll(@Query() query: PaginationQueryDto): Promise<{
    data: EmailResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const result = await this.emailsService.findAll(query);
    return {
      data: result.data as unknown as EmailResponseDto[],
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  @UseInterceptors(DecryptInterceptor)
  @ApiOperation({ summary: 'Obter detalhes de um e-mail específico' })
  @ApiResponse({
    status: 200,
    description: 'Retorna os detalhes do e-mail selecionado',
    type: EmailDetailDto,
  })
  @ApiResponse({ status: 404, description: 'E-mail não encontrado' })
  async findOne(@Param('id') id: string): Promise<EmailDetailDto> {
    const email = await this.emailsService.findOne(id);
    return email as unknown as EmailDetailDto;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualiza o status de leitura do e-mail' })
  @ApiResponse({ status: 200, description: 'Status atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'E-mail não encontrado' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
  ): Promise<{ id: string; status: string; updatedAt: string }> {
    const updated = await this.emailsService.updateStatus(id, body.status);
    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
