import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import {
  hashPassword,
  hashToken,
  isLegacyMd5Hash,
  safeEqual,
  verifyPassword,
} from './password.util';
import { User } from '@prisma/client';
import { RegisterData } from '../interfaces';
import { SendgridService } from '../sendgrid/sendgrid.service';
import { getOidcConfig } from './oidc.config';
import { OidcService } from './oidc.service';
/**
 * the auth service covers everything regarding authentication
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private sendgridService: SendgridService,
    private oidcService: OidcService,
  ) {}

  /**
   * Exchanges a DocPouch access token for a PGT token pair.
   *
   * Called once after the OIDC login (and after a re-exchange triggered by a
   * 401 in the frontend). DocPouch is not contacted on regular API requests,
   * which keeps us far below its rate limits.
   */
  async exchangeOidcToken(docPouchToken: string) {
    if (!docPouchToken) {
      throw new BadRequestException('DOCPOUCH_TOKEN_REQUIRED');
    }

    const identity = await this.oidcService.whoami(docPouchToken);
    const user = await this.userService.upsertOidcUser(identity);

    this.logger.log('User ' + user.email + ' logged in via DocPouch');
    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(user.email, tokens.refreshToken);
    return tokens;
  }

  /**
   * checks if a user can be found given his email and checks their password
   * @param email
   * @param pass
   * @returns the user if succeeded or null if not
   */
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.getUser(email);
    if (!user || !(await verifyPassword(pass, user.password))) {
      return null;
    }

    // upgrade old MD5 hashes to bcrypt now that we know the plain password
    if (isLegacyMd5Hash(user.password)) {
      await this.userService.updateUser({
        where: { email: user.email },
        data: { password: await hashPassword(pass) },
      });
      this.logger.log(`Password hash of ${user.email} upgraded to bcrypt`);
    }

    const { password, refreshToken, registerToken, ...result } = user;
    return result;
  }

  async login(user: User) {
    this.logger.log('User ' + user.email + ' logged in');
    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(user.email, tokens.refreshToken);
    return tokens;
  }

  async logout(email: string) {
    this.logger.log('User ' + email + ' logged out');
    return this.userService.updateUser({
      where: { email: email },
      data: { refreshToken: null },
    });
  }

  async register(registerData: RegisterData, lang: string) {
    let user = await this.userService.getUser(registerData.email);

    this.logger.log(
      `User ${registerData.firstName} ${registerData.lastName} (${registerData.email}) is trying to register as admin`,
    );

    // if there was no user, make a new one (without password for now)
    if (!user) {
      this.logger.log(`User ${registerData.email} didn't exist`);
      user = await this.userService.registerUser(
        registerData.email,
        registerData.firstName,
        registerData.lastName,
        registerData.company,
      );
    } else if (user.roles.includes('ADMIN')) {
      // the user already has the admin-role, which means he is already registered
      this.logger.log(`user ${registerData.email} was already an admin`);
      throw new BadRequestException(undefined, 'User already exists');
    }

    // IMPORTANT: password and names are NOT written to the user yet.
    // They are stored inside the signed registerToken and only applied
    // after the owner of the e-mail address has confirmed it.
    // Otherwise anybody could change the data of an existing account.
    const registerToken = await this.jwtService.signAsync(
      {
        email: registerData.email,
        pwHash: await hashPassword(registerData.password),
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        company: registerData.company ?? null,
      },
      {
        secret: process.env['JWT_REGISTRATION_SECRET'],
        expiresIn: '1h',
      },
    );

    await this.userService.setRegisterTokenOnUser(user.userId, registerToken);

    // the mail uses the names entered in the form
    await this.sendgridService.adminConfirmationRequest(
      {
        ...user,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        registerToken,
      },
      lang,
    );

    return;
  }

  async confirmEmail(registerToken: string) {
    this.logger.log(`User is trying to confirm e-mail`);

    // verifying the jwt
    let payload: {
      email: string;
      pwHash: string;
      firstName: string;
      lastName: string;
      company: string | null;
    };
    try {
      payload = this.jwtService.verify(registerToken, {
        secret: process.env['JWT_REGISTRATION_SECRET'],
      });
    } catch (error) {
      this.logger.warn(`token verification error: ${error.message}`);
      // same answer for every failure: do not reveal details to the client
      throw new BadRequestException('INVALID_REGISTER_TOKEN');
    }

    // the token must be the latest one stored on the user
    const user = await this.userService.getUserByRegisterToken(registerToken);

    if (!user || user.email !== payload.email || !payload.pwHash) {
      this.logger.warn(`registerToken for ${payload.email} not valid anymore`);
      throw new BadRequestException('INVALID_REGISTER_TOKEN');
    }

    // getting here means all worked out: now the entered data is applied,
    // the registerToken is removed and the user gets the admin role
    this.logger.log(`User ${user.email} e-mail confirmation succeeded`);
    return this.userService.completeRegistration(user.userId, {
      password: payload.pwHash,
      firstName: payload.firstName,
      lastName: payload.lastName,
      company: payload.company,
    });
  }

  async getTokens(user: User) {
    const { accessTokenTtl, refreshTokenTtl } = getOidcConfig();
    const email = user.email == undefined ? undefined : user.email;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { email: email },
        {
          secret: process.env['JWT_SECRET'],
          expiresIn: accessTokenTtl,
        },
      ),
      this.jwtService.signAsync(
        { email: email },
        {
          secret: process.env['JWT_REFRESH_SECRET'],
          expiresIn: refreshTokenTtl,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async updateRefreshToken(email: string, refreshToken: string) {
    const hashedRefreshToken = hashToken(refreshToken);
    await this.userService.updateUser({
      where: { email: email },
      data: { refreshToken: hashedRefreshToken },
    });
  }

  async refreshTokens(email: string, refreshToken: string) {
    const user = await this.userService.getUser(email);
    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = safeEqual(
      user.refreshToken,
      hashToken(refreshToken),
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }
    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(email, tokens.refreshToken);
    return tokens;
  }
}
