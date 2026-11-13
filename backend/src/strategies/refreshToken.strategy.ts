import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env['JWT_REFRESH_SECRET'],
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    // passport already checked that the header exists, but stay defensive
    const refreshToken = (req.get('Authorization') || '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    return { ...payload, refreshToken };
  }
}
