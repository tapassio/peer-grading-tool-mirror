import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  Req,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { I18n, I18nContext } from 'nestjs-i18n';
import { getOidcConfig, isOidcMode } from './oidc.config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private userService: UserService,
  ) {}

  /**
   * Public auth configuration for the frontend. Tells the SPA whether to use
   * DocPouch OIDC or the legacy local login, and provides the OIDC parameters
   * so neither the client id nor the issuer has to be hardcoded in the build.
   */
  @Get('config')
  getAuthConfig() {
    const cfg = getOidcConfig();

    if (cfg.mode !== 'oidc') {
      return { mode: 'local' };
    }

    return {
      mode: cfg.mode,
      docPouchUrl: cfg.docPouchUrl,
      issuer: cfg.issuer,
      clientId: cfg.clientId,
      redirectUri: cfg.redirectUri,
      postLogoutRedirectUri: cfg.postLogoutRedirectUri,
      scope: cfg.scope,
    };
  }

  /**
   * Exchanges a DocPouch access token for a PGT token pair. This is the only
   * place where the PGT backend talks to DocPouch during a session.
   */
  @Post('oidc/exchange')
  async exchangeOidcToken(@Headers('authorization') authorization?: string) {
    const token = (authorization || '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!token) {
      throw new UnauthorizedException('DOCPOUCH_TOKEN_REQUIRED');
    }

    return this.authService.exchangeOidcToken(token);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    this.assertLocalAuthEnabled();
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.userService.getUser(req.user.email);
    delete user['password'];
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req) {
    return this.authService.logout(req.user.email);
  }

  @Post('register')
  async registerUser(@Body() registerData, @I18n() i18n: I18nContext) {
    this.assertLocalAuthEnabled();
    return this.authService.register(registerData, i18n.lang);
  }

  @Post('confirm-email')
  async confirmEmail(@Body() registerTokenData: any) {
    this.assertLocalAuthEnabled();
    return this.authService.confirmEmail(registerTokenData.registerToken);
  }

  @UseGuards(JwtRefreshGuard)
  @Get('refresh')
  refreshTokens(@Req() req) {
    const email = req.user.email;
    const refreshToken = req.user['refreshToken'];
    return this.authService.refreshTokens(email, refreshToken);
  }

  private assertLocalAuthEnabled() {
    if (isOidcMode()) {
      throw new NotFoundException('LOCAL_AUTH_DISABLED');
    }
  }
}
