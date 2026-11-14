import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { readRefreshCookie } from '../auth/refresh-cookie';

/**
 * The refresh token comes from the HttpOnly cookie (see refresh-cookie.ts),
 * not from the Authorization header.
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => readRefreshCookie(req),
      secretOrKey: process.env['JWT_REFRESH_SECRET'],
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    return { ...payload, refreshToken: readRefreshCookie(req) };
  }
}
