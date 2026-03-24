import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  provider?: string;
}

export class OAuthDisconnectDto {
  @IsString()
  @IsOptional()
  provider?: string;
}
