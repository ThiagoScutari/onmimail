import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAll(): Promise<Record<string, string>> {
    return this.settingsService.getAll();
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<{ key: string; updated: boolean }> {
    await this.settingsService.set(key, dto.value);
    return { key, updated: true };
  }

  @Post('telegram/test')
  async testTelegram(): Promise<{ success: boolean; message: string }> {
    return this.settingsService.testTelegram();
  }
}
