import { Component, LOCALE_ID, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';

@Component({
    selector: 'pgt-language-switch',
    templateUrl: './language-switch.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './language-switch.component.css',
    imports: [
        MatMenuTrigger,
        MatMenu,
        MatMenuItem,
    ],
})
export class LanguageSwitchComponent {
  currentLocale = inject(LOCALE_ID);
  private router = inject(Router);


  getDisplayedLocaleString(locale: string) {
    switch (locale) {
      case 'de':
        return `${locale.toUpperCase()}`;
      case 'en':
        return `${locale.toUpperCase()}`;
      default:
        return '';
    }
  }

  changeLocale(locale: string) {
    if (this.currentLocale != locale)
      window.location.assign('/' + locale + this.router.url);
  }
}
