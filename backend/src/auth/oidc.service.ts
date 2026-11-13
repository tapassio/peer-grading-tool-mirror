import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { getOidcConfig } from './oidc.config';

const WINDOW_MS = 15 * 60 * 1000; // DocPouch rate-limit window

/**
 * Protects DocPouch's rate limit (100 GET requests / 15 min per IP; all PGT
 * requests come from the same server IP):
 * - tokens DocPouch rejected are remembered and never sent again
 * - an IP address with 3 rejected tokens is blocked for 15 minutes
 * - a budget limits the DocPouch requests per 15 minutes for the whole server
 * Exported for tests.
 */
export class DocPouchRequestGuard {
  private rejected = new Map<string, number>(); // token hash -> expiry
  private requests: number[] = []; // timestamps of DocPouch requests
  private failures = new Map<string, number[]>(); // ip -> timestamps
  static readonly MAX_FAILURES_PER_IP = 3;

  constructor(
    private budget: () => number,
    private now: () => number = Date.now,
  ) {}

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  isKnownInvalid(token: string): boolean {
    const key = DocPouchRequestGuard.hash(token);
    const expiry = this.rejected.get(key);
    if (expiry === undefined) return false;
    if (expiry < this.now()) {
      this.rejected.delete(key);
      return false;
    }
    return true;
  }

  rememberInvalid(token: string, ip?: string) {
    // keep the maps small: drop expired entries, hard cap 10'000
    const t = this.now();
    for (const [k, exp] of this.rejected) if (exp < t) this.rejected.delete(k);
    if (this.rejected.size >= 10000) this.rejected.clear();
    this.rejected.set(DocPouchRequestGuard.hash(token), t + WINDOW_MS);

    if (ip) {
      if (this.failures.size >= 10000) this.failures.clear();
      const recent = (this.failures.get(ip) ?? []).filter((f) => f > t - WINDOW_MS);
      recent.push(t);
      this.failures.set(ip, recent);
    }
  }

  isBlockedIp(ip?: string): boolean {
    if (!ip) return false;
    const t = this.now();
    const recent = (this.failures.get(ip) ?? []).filter((f) => f > t - WINDOW_MS);
    return recent.length >= DocPouchRequestGuard.MAX_FAILURES_PER_IP;
  }

  /** returns false when the budget for the current 15 minutes is used up */
  tryAcquire(): boolean {
    const t = this.now();
    this.requests = this.requests.filter((r) => r > t - WINDOW_MS);
    if (this.requests.length >= this.budget()) return false;
    this.requests.push(t);
    return true;
  }
}

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
  private readonly guard = new DocPouchRequestGuard(
    () => getOidcConfig().docPouchRequestBudget,
  );

  /**
   * Resolves a DocPouch access token to an identity. This is only called
   * during the token exchange (login / re-exchange), never on every PGT
   * API request, to stay well below DocPouch's rate limits.
   */
  async whoami(token: string, clientIp?: string): Promise<DocPouchIdentity> {
    const { docPouchUrl, timeoutMs } = getOidcConfig();

    // a token DocPouch already rejected: answer without asking DocPouch again
    if (this.guard.isKnownInvalid(token) || this.guard.isBlockedIp(clientIp)) {
      throw new UnauthorizedException('DOCPOUCH_INVALID_TOKEN');
    }

    if (!this.guard.tryAcquire()) {
      this.logger.warn('DocPouch request budget used up (15 min window)');
      throw new ServiceUnavailableException('DOCPOUCH_RATE_LIMITED');
    }

    try {
      const { data } = await axios.get<DocPouchIdentity>(
        `${docPouchUrl}/users/whoami`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: timeoutMs,
        },
      );

      if (!data || !data._id) {
        this.guard.rememberInvalid(token, clientIp);
        throw new UnauthorizedException('DOCPOUCH_INVALID_TOKEN');
      }

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
          this.guard.rememberInvalid(token, clientIp);
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
