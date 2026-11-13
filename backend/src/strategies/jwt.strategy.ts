import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'],
    });
  }

  async validate(payload: any) {
    // Drop the JWT bookkeeping claims (iat/exp) and expose only the identity
    // (email, roles, …) as req.user for the guards.
    let { iat, exp, ...rest } = payload;
    return {
      ...rest,
    };
  }
}
