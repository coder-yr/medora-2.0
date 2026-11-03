import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AccountLockoutService } from './account-lockout.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = (configService.get<string>('auth.jwtExpiresIn') ||
          '15m') as JwtSignOptions['expiresIn'];
        return {
          secret: configService.get<string>('auth.jwtSecret') || 'local-dev-secret',
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AccountLockoutService,
    PasswordResetService,
  ],
  exports: [
    AuthService,
    AccountLockoutService,
    PasswordResetService,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
