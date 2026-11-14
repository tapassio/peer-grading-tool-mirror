import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import DocPouchClient, { I_OidcConfig } from 'docpouch-client';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenService } from './token.service';

export interface PgtAuthConfig {
  mode: 'local' | 'oidc';
  docPouchUrl?: string;
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  scope?: string;
  /** public URL of this installation (to find its Tool Details Document) */
  publicUrl?: string;
  /** fixed DocPouch structure for published results (optional) */
  resultStructureId?: string;
  /** dev only: allow "structure with the same name" as last fallback */
  allowStructureNameFallback?: boolean;
}

interface TokenPair {
  accessToken: string;
}

const RETURN_URL_KEY = 'pgt_return_url';
const RETURN_BASE_KEY = 'pgt_return_base';

/**
 * Handles the DocPouch OIDC flow and the exchange of the DocPouch access token
 * for a PGT token pair. In local mode (`AUTH_MODE=local`) the legacy e-mail /
 * password login is used and this service stays inert.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private tokenService = inject(TokenService);

  private config: PgtAuthConfig = { mode: 'local' };
  private client: DocPouchClient | null = null;
  private initPromise: Promise<void> | null = null;
  private callbackHandled = false;
  private callbackError: string | null = null;

  /**
   * Called from APP_INITIALIZER. Loads the public auth configuration and
   * completes a pending OIDC callback or restores an existing session.
   */
  initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize();
    }
    return this.initPromise;
  }

  isOidcMode(): boolean {
    return this.config.mode === 'oidc';
  }

  getConfig(): PgtAuthConfig {
    return this.config;
  }

  /**
   * Returns the DocPouch client (OIDC mode only). Used to publish results to
   * DocPouch with the signed-in administrator's own permissions.
   */
  getDocPouchClient(): DocPouchClient | null {
    return this.isOidcMode() ? this.client : null;
  }

  /**
   * Starts the OIDC login. The browser is redirected to DocPouch; the return
   * URL is remembered so the callback can send the user back.
   */
  async loginWithDocPouch(returnUrl?: string): Promise<void> {
    if (!this.isOidcMode()) {
      return;
    }

    sessionStorage.setItem(RETURN_URL_KEY, returnUrl || '/admin-dashboard');
    sessionStorage.setItem(RETURN_BASE_KEY, document.baseURI);

    await this.docPouchClient().loginWithOidc(this.oidcConfig());
  }

  /**
   * Called by the callback component after APP_INITIALIZER completed. Sends
   * the browser back to the originally requested page, preserving the
   * language prefix (full reload, the PGT token is already stored).
   */
  finishOidcLogin(): void {
    if (this.callbackError) {
      const loginUrl = new URL('login', document.baseURI);
      loginUrl.searchParams.set('loginError', this.callbackError);
      sessionStorage.removeItem(RETURN_URL_KEY);
      sessionStorage.removeItem(RETURN_BASE_KEY);
      window.location.replace(loginUrl.toString());
      return;
    }

    const returnUrl = sessionStorage.getItem(RETURN_URL_KEY);
    const returnBase = sessionStorage.getItem(RETURN_BASE_KEY);
    sessionStorage.removeItem(RETURN_URL_KEY);
    sessionStorage.removeItem(RETURN_BASE_KEY);

    const target =
      returnBase && returnUrl
        ? new URL(returnUrl.replace(/^\//, ''), returnBase).toString()
        : new URL('admin-dashboard', document.baseURI).toString();

    window.location.replace(target);
  }

  /**
   * Clears the PGT session and, in OIDC mode, ends the DocPouch session.
   */
  logout(): void {
    const finish = () => {
      this.tokenService.signOut();

      const client = this.client;
      if (this.isOidcMode() && client && client.isAuthenticated()) {
        client
          .logout({ redirectUri: this.postLogoutRedirectUri() })
          .catch(() => this.redirectToLogin());
        return;
      }

      this.redirectToLogin();
    };

    this.http.post(environment.api + '/auth/logout', {}).subscribe({
      complete: finish,
      error: finish,
    });
  }

  /**
   * Used by the error interceptor: obtains a fresh DocPouch access token and
   * exchanges it for a new PGT token pair. Returns false when this is not
   * possible, so the caller can fall back to a full logout.
   */
  async renewPgtSession(): Promise<boolean> {
    if (!this.isOidcMode()) {
      return false;
    }

    try {
      await this.exchange();
      return true;
    } catch {
      return false;
    }
  }

  private async doInitialize(): Promise<void> {
    try {
      this.config = await firstValueFrom(
        this.http.get<PgtAuthConfig>(environment.api + '/auth/config')
      );
    } catch {
      // Backend not reachable: keep local behaviour, requests will fail
      // with their usual error handling.
      this.config = { mode: 'local' };
      return;
    }

    if (!this.isOidcMode()) {
      await this.restoreLocalSession();
      return;
    }

    const client = this.docPouchClient();
    client.setOidcConfig(this.oidcConfig());

    // 1. Returning from the DocPouch login redirect.
    const search = new URLSearchParams(window.location.search);
    if (search.has('code') || search.has('error')) {
      try {
        const handled = await client.handleOidcCallback();
        if (handled) {
          await this.exchange();
          this.callbackHandled = true;
        }
      } catch (error) {
        this.callbackError = this.extractErrorCode(error);
        console.error('DocPouch OIDC callback failed', error);
      }
      return;
    }

    // 2. Page reload or new tab: the PGT access token is only kept in memory,
    //    so it is fetched again with the DocPouch session (silent re-login).
    if (client.restoreOidcSession()) {
      try {
        await this.exchange();
      } catch (error) {
        this.callbackError = this.extractErrorCode(error);
        console.error('Silent DocPouch login failed', error);
      }
    }
  }

  private async exchange(): Promise<void> {
    const token = await this.docPouchClient().ensureValidOidcToken();

    const tokens = await firstValueFrom(
      this.http.post<TokenPair>(environment.api + '/auth/oidc/exchange', null, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
          // Prevent the main interceptor from overwriting the DocPouch token
          // with the PGT access token.
          skipAuth: 'true',
        }),
      })
    );

    this.tokenService.setAccessToken(tokens.accessToken);
  }

  /**
   * Local mode: the access token is only kept in memory, so after a page
   * reload it is fetched again with the HttpOnly refresh cookie.
   */
  private async restoreLocalSession(): Promise<void> {
    try {
      const tokens = await firstValueFrom(
        this.http.get<TokenPair>(environment.api + '/auth/refresh', {
          withCredentials: true,
        })
      );
      this.tokenService.setAccessToken(tokens.accessToken);
    } catch {
      // no (valid) cookie: not logged in
    }
  }

  private docPouchClient(): DocPouchClient {
    if (!this.client) {
      this.client = new DocPouchClient(this.config.docPouchUrl || '', 0);
    }
    return this.client;
  }

  private oidcConfig(): I_OidcConfig {
    return {
      issuer: this.config.issuer as string,
      clientId: this.config.clientId as string,
      redirectUri: this.oidcRedirectUri(),
      scope: this.config.scope,
      postLogoutRedirectUri: this.postLogoutRedirectUri(),
    };
  }

  /**
   * The OIDC redirect URI has to include the current language prefix (`/de/`,
   * `/en/`, …), because the localized Angular build serves each locale under
   * its own base href. The backend cannot know the locale, so the URI is
   * derived from `document.baseURI`, which already points at the locale root.
   * Every locale variant must be registered as a redirect URI with DocPouch.
   */
  private oidcRedirectUri(): string {
    if (typeof document === 'undefined' || !document.baseURI) {
      return this.config.redirectUri as string;
    }
    return new URL('auth/callback', document.baseURI).toString();
  }

  /**
   * Locale-aware post-logout redirect (the language root). Derived from
   * `document.baseURI` for the same reason as {@link oidcRedirectUri}.
   */
  private postLogoutRedirectUri(): string {
    if (typeof document === 'undefined' || !document.baseURI) {
      return this.config.postLogoutRedirectUri as string;
    }
    return new URL('./', document.baseURI).toString();
  }

  private redirectToLogin(): void {
    window.location.replace(new URL('login', document.baseURI).toString());
  }

  private extractErrorCode(error: any): string {
    return (
      error?.error?.message ||
      error?.error?.error ||
      error?.message ||
      'OIDC_LOGIN_FAILED'
    );
  }
}
