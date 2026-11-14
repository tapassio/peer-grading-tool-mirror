import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Landing page for the DocPouch OIDC redirect. The actual token exchange is
 * done in AuthService.initialize() before bootstrap; this component only
 * forwards the user back to the originally requested page.
 */
@Component({
    selector: 'pgt-auth-callback',
    templateUrl: './auth-callback.component.html',
    styleUrls: ['./auth-callback.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AuthCallbackComponent implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.finishOidcLogin();
  }
}
