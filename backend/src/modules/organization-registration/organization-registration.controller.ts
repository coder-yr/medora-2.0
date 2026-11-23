import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { OrganizationRegistrationService } from './organization-registration.service';
import { CreateOrganizationRegistrationDto } from './dto/create-registration.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@Controller('organization-registrations')
export class OrganizationRegistrationController {
  constructor(
    private readonly registrationService: OrganizationRegistrationService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: CreateOrganizationRegistrationDto) {
    return this.registrationService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.registrationService.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.registrationService.resendVerification(dto.referenceOrEmail);
  }

  @Public()
  @Get('status/:reference')
  async getStatus(@Param('reference') reference: string) {
    return this.registrationService.getStatus(reference);
  }
}
