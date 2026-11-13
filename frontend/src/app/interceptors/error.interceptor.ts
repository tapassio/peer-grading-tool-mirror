import { Injector, Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import {
  BehaviorSubject,
  catchError,
  from,
  Observable,
  Subject,
  Subscription,
  switchMap,
  throwError,
} from 'rxjs';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  static accessTokenError: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private tokenService: TokenService,
    private injector: Injector
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const isRefresh = request.url.endsWith('auth/refresh');
    const isLogin = request.url.endsWith('auth/login');
    const isRegister = request.url.endsWith('auth/register');
    const isExchange = request.url.endsWith('auth/oidc/exchange');
    const isAuthConfig = request.url.endsWith('auth/config');

    return next.handle(request).pipe(
      catchError((err: HttpErrorResponse) => {
        if (
          err.status === 401 &&
          !isRefresh &&
          !isLogin &&
          !isRegister &&
          !isExchange &&
          !isAuthConfig
        ) {
          const authService = this.injector.get(AuthService);

          // In OIDC mode the PGT access token can be renewed by exchanging a
          // fresh DocPouch token. This needs no extra DocPouch request beyond
          // the one exchange call.
          if (authService.isOidcMode()) {
            return from(authService.renewPgtSession()).pipe(
              switchMap((renewed) =>
                renewed
                  ? next.handle(this.withAccessToken(request))
                  : this.failAuthentication(err)
              ),
              catchError(() => this.failAuthentication(err))
            );
          }

          return this.refreshToken(next, request);
        }
        // this.router.navigate(['/error/' + err.status]);
        return throwError(() => err);
      })
    );
  }

  /**
   * this function handles 401 errors and tries to refresh the access token
   * for multiple 401 errors, the first gets the new tokens and all other wait until the new tokens arrive
   */
  refreshToken(
    next: HttpHandler,
    request: HttpRequest<any>
  ): Observable<HttpEvent<any>> {
    if (!ErrorInterceptor.accessTokenError.getValue()) {
      ErrorInterceptor.accessTokenError.next(true);

      // gets the new tokens
      return this.http.get(environment.api + '/auth/refresh').pipe(
        switchMap((user: any) => {
          // Save new Tokens
          this.tokenService.setAccessToken(user.accessToken);
          this.tokenService.setRefreshToken(user.refreshToken);

          ErrorInterceptor.accessTokenError.next(false);
          // Clone the request with new Access Token
          return next.handle(this.withAccessToken(request));
        }),
        catchError((err: HttpErrorResponse) => {
          // in case even the refresh failed
          ErrorInterceptor.accessTokenError.next(false);
          return this.failAuthentication(err);
        })
      );
    } else {
      // If it's not the first error, it has to wait until the new tokens arrive
      return this.awaitNewTokens().pipe(
        switchMap(() => {
          // Clone the request with new Access Token
          return next.handle(this.withAccessToken(request));
        })
      );
    }
  }

  private withAccessToken(request: HttpRequest<any>): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${this.tokenService.getToken()}`,
      },
    });
  }

  private failAuthentication(err: HttpErrorResponse): Observable<never> {
    this.tokenService.signOut();
    // reloading the location without tokens will fire the auth guard to return to login
    location.reload();
    return throwError(() => err);
  }

  /**
   * lets a request wait until the new access tokens are set
   * @returns
   */
  private awaitNewTokens(): Observable<any> {
    const subject = new Subject<any>();

    const awaitToken: Subscription =
      ErrorInterceptor.accessTokenError.subscribe((error: boolean) => {
        if (!error) {
          subject.next(true);
          awaitToken.unsubscribe();
        }
      });
    return subject.asObservable();
  }
}
