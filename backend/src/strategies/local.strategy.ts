import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { isOidcMode } from '../auth/oidc.config';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    // In OIDC mode local password login is disabled entirely; the guard runs
    // before the controller handler, so the check has to live here as well.
    if (isOidcMode()) {
      throw new NotFoundException('LOCAL_AUTH_DISABLED');
    }

    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
