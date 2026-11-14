import { HttpHeaders, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenService } from '../services/token.service';
import { MainInterceptor } from './main.interceptor';

describe('MainInterceptor', () => {
  let tokens: TokenService;
  let interceptor: MainInterceptor;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TokenService, MainInterceptor] });
    tokens = TestBed.inject(TokenService);
    interceptor = TestBed.inject(MainInterceptor);
    tokens.setAccessToken('access');
  });

  function send(url: string, headers = new HttpHeaders()) {
    let sent!: HttpRequest<any>;
    interceptor
      .intercept(new HttpRequest('GET', url, { headers }), {
        handle: (r: HttpRequest<any>) => {
          sent = r;
          return of({} as any);
        },
      })
      .subscribe();
    return sent;
  }


  it('sends the access token to the API', () => {
    const r = send(environment.api + '/campaign');
    expect(r.headers.get('Authorization')).toBe('Bearer access');
    expect(r.withCredentials).toBe(false);
  });

  it('auth requests send the refresh cookie (withCredentials)', () => {
    const r = send(environment.api + '/auth/refresh');
    expect(r.withCredentials).toBe(true);
    // the refresh token is never put into a header by JavaScript
    expect(r.headers.get('Authorization')).toBe('Bearer access');
  });

  it('no token and no cookie for other hosts', () => {
    const r = send('https://docpouch.example/api/x');
    expect(r.headers.has('Authorization')).toBe(false);
    expect(r.withCredentials).toBe(false);
  });

  it('skipAuth keeps the DocPouch token for the exchange', () => {
    const r = send(
      environment.api + '/auth/oidc/exchange',
      new HttpHeaders({ Authorization: 'Bearer docpouch', skipAuth: 'true' })
    );
    expect(r.headers.get('Authorization')).toBe('Bearer docpouch');
  });
});
