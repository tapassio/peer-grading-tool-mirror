import { Inject, Injectable, LOCALE_ID } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class LangInterceptor implements HttpInterceptor {
  constructor(@Inject(LOCALE_ID) public currentLocale: string) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Get the desired language from your application (e.g., from a service)
    const lang = this.currentLocale;

    // Clone the request and add the 'lang' header
    const modifiedRequest = request.clone({
      setHeaders: {
        lang: lang,
      },
    });

    // Pass the modified request to the next handler
    return next.handle(modifiedRequest);
  }
}
