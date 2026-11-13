import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { getOidcConfig } from './oidc.config';

/**
 * Identity returned by DocPouch's `GET /users/whoami` endpoint.
 * The endpoint accepts both DocPouch JWTs and OIDC access tokens.
 */
export interface DocPouchIdentity {
  _id: string;
  name?: string;
  email?: string;
  isAdmin?: boolean;
  role?: 'member' | 'manager' | 'admin' | 'superadmin' | string;
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  /**
   * Resolves a DocPouch access token to an identity. This is only called
   * during the token exchange (login / re-exchange), never on every PGT
   * API request, to stay well below DocPouch's rate limits.
   */
  async whoami(token: string): Promise<DocPouchIdentity> {
    const { docPouchUrl, timeoutMs } = getOidcConfig();

    try {
      const { data } = await axios.get<DocPouchIdentity>(
        `${docPouchUrl}/users/whoami`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: timeoutMs,
        },
      );

      if (!data || !data._id) {
        throw new UnauthorizedException('DOCPOUCH_INVALID_TOKEN');
      }

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
          throw new UnauthorizedException('DOCPOUCH_INVALID_TOKEN');
        }

        if (status === 429) {
          this.logger.warn('DocPouch rate limit hit during whoami');
          throw new ServiceUnavailableException('DOCPOUCH_RATE_LIMITED');
        }

        this.logger.error(`DocPouch whoami failed: ${error.message}`);
        throw new ServiceUnavailableException('DOCPOUCH_UNAVAILABLE');
      }

      throw error;
    }
  }
}
