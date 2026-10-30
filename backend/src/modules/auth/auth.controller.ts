import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { AuthService } from './auth.service';
import { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Authentication & Identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Brute-force protection: 5 attempts per minute
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate staff user and receive JWT access and refresh tokens' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
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

  @ApiBearerAuth()
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
      permissions: user.permissions,
      branchId: user.branchId ? String(user.branchId) : null,
    };
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(HospitalPermission.PATIENT_VIEW)
  @Get('test-patient-view')
  @ApiOperation({ summary: 'Test endpoint requiring patient_view permission' })
  @ApiResponse({ status: 200, description: 'Permission granted' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions' })
  testPatientPermission(@CurrentUser() user: AuthUser) {
    return {
      message: 'Access granted to patient view',
      grantedTo: user.email,
      role: user.group,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get('test-admin-role')
  @ApiOperation({ summary: 'Test endpoint requiring Admin role' })
  @ApiResponse({ status: 200, description: 'Admin access verified' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires Admin role' })
  testAdminRole(@CurrentUser() user: AuthUser) {
    return {
      message: 'Admin access verified',
      user: user.email,
    };
  }
}
