import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from '../strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { RefreshTokenStrategy } from '../strategies/refreshToken.strategy';
import { SendgridService } from '../sendgrid/sendgrid.service';
import { SanitizeService } from '../sanitize/sanitize.service';
import { OidcService } from './oidc.service';

@Module({
  imports: [UserModule, PassportModule, JwtModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OidcService,
    LocalStrategy,
    JwtStrategy,
    RefreshTokenStrategy,
    SendgridService,
    SanitizeService,
  ],
})
export class AuthModule {}
