import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SkipBranchCheck } from '../../common/decorators/skip-branch.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import { AuthService } from './auth.service';
import { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { VerifyMfaDto, ConfirmMfaDto, DisableMfaDto } from './dto/mfa.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';

@ApiTags('Authentication & Identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Brute-force protection: 5 attempts per minute per IP
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate staff user and receive JWT access and refresh tokens' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password / Account locked' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.login(loginDto, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new clinical or administrative staff member' })
  @ApiResponse({ status: 201, type: AuthResponseDto, description: 'Staff registration successful' })
  @ApiResponse({ status: 409, description: 'Staff account already exists with this email' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.register(registerDto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and receive new short-lived access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.refresh(refreshTokenDto, ip, userAgent);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active session and refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ message: string }> {
    return this.authService.logout(refreshTokenDto);
  }

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Validate organization staff invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation details' })
  @ApiResponse({ status: 400, description: 'Expired or already accepted invitation' })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  async validateInvitation(@Param('token') token: string) {
    return this.authService.validateInvitation(token);
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept invitation, set password and activate membership' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Invitation accepted and logged in' })
  @ApiResponse({ status: 400, description: 'Invalid token or expired' })
  async acceptInvitation(
    @Body() dto: { token: string; password: string; name?: string },
  ): Promise<AuthResponseDto> {
    return this.authService.acceptInvitation(dto);
  }

  @ApiBearerAuth()
  @SkipBranchCheck()
  @Get('me')
  @ApiOperation({ summary: 'Retrieve currently authenticated user profile and permissions' })
  @ApiResponse({ status: 200, type: UserProfileDto, description: 'Authenticated profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@CurrentUser() user: AuthUser): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      group: user.group,
      role: user.group,
      permissions: user.permissions,
      branchId: user.branchId ? String(user.branchId) : null,
      organizationId: user.organizationId ? String(user.organizationId) : null,
      organizationRole: user.organizationRole || null,
      organizationEdition: user.organizationEdition || null,
      organizationStatus: user.organizationStatus || null,
      isSuperAdmin: Boolean(user.isSuperAdmin),
    };
  }

  @ApiBearerAuth()
  @SkipBranchCheck()
  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active workspace organization context and receive new scoped JWT' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Switched organization workspace successfully' })
  @ApiResponse({ status: 403, description: 'User does not belong to target organization or target organization is suspended' })
  @ApiResponse({ status: 404, description: 'Target organization not found' })
  async switchOrganization(
    @CurrentUser() user: AuthUser,
    @Body() dto: SwitchOrganizationDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.switchOrganization(user, dto.organizationId, ip, userAgent);
  }

  @ApiBearerAuth()
  @SkipBranchCheck()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for currently authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed and active sessions invalidated' })
  @ApiResponse({ status: 400, description: 'Invalid password format or matches current password' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.id, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset instructions (generic response to prevent enumeration)' })
  @ApiResponse({ status: 200, description: 'Reset instructions dispatched if account exists' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const res = await this.authService.forgotPassword(dto);
    return { message: res.message };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset account password using single-use cryptographically secure token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Brute-force protection: 5 attempts per minute per IP
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA challenge using TOTP code or recovery key' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'MFA verified and session issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired challenge ticket / incorrect code' })
  async verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.verifyMfa(dto, ip, userAgent);
  }

  @ApiBearerAuth()
  @SkipBranchCheck()
  @Post('mfa/enroll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate TOTP MFA enrollment and receive secret and QR code' })
  @ApiResponse({ status: 200, description: 'MFA secret and QR code generated' })
  async enrollMfa(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.enrollMfa(user.id, ip, userAgent);
  }

  @ApiBearerAuth()
  @SkipBranchCheck()
  @Post('mfa/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm MFA setup by verifying first code and receive recovery codes' })
  @ApiResponse({ status: 200, description: 'MFA enabled and recovery codes generated' })
  async confirmMfa(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmMfaDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.confirmMfa(user.id, dto.code, ip, userAgent);
  }

  @ApiBearerAuth()
  @SkipBranchCheck()
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA after verifying password and TOTP/recovery code' })
  @ApiResponse({ status: 200, description: 'MFA disabled and all active sessions revoked' })
  async disableMfa(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableMfaDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.disableMfa(user.id, dto, ip, userAgent);
  }
}
