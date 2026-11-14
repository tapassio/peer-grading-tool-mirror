import { Component, Inject, LOCALE_ID, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'pgt-language-switch',
  standalone: false,
  templateUrl: './language-switch.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './language-switch.component.css',
})
export class LanguageSwitchComponent {
  constructor(
    @Inject(LOCALE_ID) public currentLocale: string,
    private router: Router
  ) {}

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
