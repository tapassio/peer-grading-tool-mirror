import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Md5 } from 'ts-md5';
import { User } from '@prisma/client';
import { RegisterData } from 'src/interfaces';
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
  async validateUser(email: string, pass: string): Promise<User> {
    const user = await this.userService.getUser(email);
    const passEncrypted = this.hashData(pass);
    if (user && this.matchingPW(user.password, passEncrypted)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
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

    // if there was no user, make a new one and set it to the user var
    if (!user) {
      this.logger.log(`User ${registerData.email} didn't exist`);
      user = await this.userService.registerUser(
        registerData.email,
        registerData.password,
        registerData.firstName,
        registerData.lastName,
        registerData.company,
      );
    } else {
      // checking if the user already has the admin-role,
      // which means he is already registered
      if (user.roles.includes('ADMIN')) {
        this.logger.log(`user ${registerData.email} was already an admin`);
        throw new BadRequestException(undefined, 'User already exists');
      }
      // for existing users, updating the user to the data entered when registering
      user = await this.userService.updateUser({
        where: {
          email: registerData.email,
        },
        data: {
          password: this.hashData(registerData.password),
          firstName: registerData.firstName,
          lastName: registerData.lastName,
          company: registerData.company,
        },
      });
    }

    // now the user exists or has already existed
    // creating the user's registerToken
    const registerToken = await this.jwtService.signAsync(
      {
        email: registerData.email,
      },
      {
        secret: process.env['JWT_REGISTRATION_SECRET'],
        expiresIn: '1h',
      },
    );

    // setting the token
    await this.userService.setRegisterTokenOnUser(user.userId, registerToken);

    user.registerToken = registerToken;

    // and sending an email with a link with that token
    await this.sendgridService.adminConfirmationRequest(user, lang);

    return;
  }

  async confirmEmail(registerToken: string) {
    this.logger.log(`User is trying to confirm e-mail`);

    // verifying the jwt
    try {
      this.jwtService.verify(registerToken, {
        secret: process.env['JWT_REGISTRATION_SECRET'],
      });
    } catch (error) {
      this.logger.error(`token verification error: ${error.message}`);
      throw new InternalServerErrorException(undefined, error.message);
    }

    // trying to find a user by the registerToken
    let user = await this.userService.getUserByRegisterToken(registerToken);

    // if no user was found by registerToken, the registration failed
    if (!user) {
      // trying to find out the reason it failed by decoding token
      const decodedRegisterToken = this.jwtService.decode(registerToken);

      this.logger.log(
        `User ${decodedRegisterToken['email']} was not found by registerToken`,
      );

      // and getting the user by email
      user = await this.userService.getUser(decodedRegisterToken['email']);

      // if still no user was found then he did not exist
      if (!user) {
        this.logger.log(`User ${decodedRegisterToken['email']} did not exists`);
        throw new InternalServerErrorException(
          undefined,
          'User did not exist.',
        );
      }

      // if the user was found, that means that he was not set up for registration
      this.logger.log(
        `User ${decodedRegisterToken['email']} was not set up for registration`,
      );
      throw new InternalServerErrorException(
        undefined,
        'User was not in the registration process.',
      );
    }

    // getting here means all worked out
    // which will then unset the user's registerToken
    // and add the admin role to the user, finally letting the user log in
    this.logger.log(`User ${user.email} e-mail confirmation succeeded`);
    return this.userService.completeRegistration(user.userId);
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
    const hashedRefreshToken = this.hashData(refreshToken);
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

    const refreshTokenMatches = this.matchingPW(
      user.refreshToken,
      this.hashData(refreshToken),
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }
    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(email, tokens.refreshToken);
    return tokens;
  }

  hashData(data: string): string {
    return Md5.hashStr(data);
  }

  matchingPW(value1: string, value2: string): boolean {
    return value1 == value2;
  }
}
