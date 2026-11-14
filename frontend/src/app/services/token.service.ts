import { Injectable } from '@angular/core';

/**
 * Keeps the PGT access token. It lives only in memory (not in localStorage),
 * so an XSS bug cannot steal a stored token. The refresh token is an
 * HttpOnly cookie that only the backend can read (see refresh-cookie.ts).
 * After a page reload the session is restored by AuthService.initialize().
 */
@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private accessToken: string | null = null;

  constructor() {
    // tokens stored by older versions of the PGT
    this.removeLegacyTokens();
  }

  signOut(): void {
    window.sessionStorage.clear();
    this.accessToken = null;
    this.removeLegacyTokens();
  }

  getToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token || null;
  }

  hasToken(): boolean {
    return this.accessToken !== null;
  }

  private removeLegacyTokens() {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } catch {
      // storage not available (e.g. blocked): nothing to remove
    }
  }
}
