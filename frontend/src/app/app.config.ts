import { DatePipe } from '@angular/common';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { LangInterceptor } from './interceptors/lang.interceptor';
import { MainInterceptor } from './interceptors/main.interceptor';
import { AuthService } from './services/auth.service';

/**
 * App-wide setup (replaces the old app.module.ts).
 * Components import what they need themselves (standalone components).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // the app relies on zone.js change detection (as before)
    provideZoneChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: LangInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: MainInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    // load the auth config / restore the session before the first page
    provideAppInitializer(() => inject(AuthService).initialize()),
    DatePipe,
  ],
};
