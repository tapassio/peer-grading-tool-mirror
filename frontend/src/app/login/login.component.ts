import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SnackBarService } from '../services/snack-bar.service';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormErrorComponent } from '../form-error/form-error.component';
/**
 * the login component handles user logins
 * currently only admin users can login.
 *
 * In OIDC mode the local form is replaced by a DocPouch login button.
 */
@Component({
    selector: 'pgt-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatIcon, ReactiveFormsModule, FormErrorComponent]
})
export class LoginComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  userService = inject(UserService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private snackBarService = inject(SnackBarService);
  private authService = inject(AuthService);

  loginForm: FormGroup;
  oidcMode = false;

  /**
   * upon initialization the loginform is built
   */
  ngOnInit(): void {
    this.oidcMode = this.authService.isOidcMode();

    if (this.activatedRoute.snapshot.queryParams['returnUrl']) {
      this.snackBarService.openSnackBar($localize`Anmeldung erforderlich.`);
    }

    const loginError = this.activatedRoute.snapshot.queryParams['loginError'];
    if (loginError) {
      this.showLoginError(loginError);
    }

    this.loginForm = this.formBuilder.group({
      email: [null, [Validators.required]],
      password: [null, [Validators.required]],
    });
  }

  navigateToAbout() {
    this.router.navigate(['/about']);
  }

  /**
   * this function is used when the login button is clicked
   * @param loginForm
   */
  login(loginForm: FormGroup) {
    if (loginForm.valid) {
      const returnUrl =
        this.activatedRoute.snapshot.queryParams['returnUrl'] ||
        '/admin-dashboard';
      this.userService.login(loginForm.value, returnUrl);
    } else {
      loginForm.markAllAsTouched();
    }
  }

  /**
   * Starts the DocPouch OIDC login. The browser is redirected to DocPouch.
   */
  async loginWithDocPouch() {
    const returnUrl =
      this.activatedRoute.snapshot.queryParams['returnUrl'] ||
      '/admin-dashboard';

    try {
      await this.authService.loginWithDocPouch(returnUrl);
    } catch {
      this.snackBarService.openSnackBar(
        $localize`Anmeldung über DocPouch fehlgeschlagen.`
      );
    }
  }

  /**
   * this function is used when the register button is clicked
   */
  navigateToRegister() {
    this.router.navigate(['/register']);
  }

  private showLoginError(code: string) {
    switch (code) {
      case 'PGT_ACCESS_DENIED':
      case 'DOCPOUCH_EMAIL_REQUIRED':
        this.snackBarService.openSnackBar(
          $localize`Zugriff nur für Administratoren gestattet`
        );
        break;
      case 'DOCPOUCH_EMAIL_IN_USE':
        this.snackBarService.openSnackBar(
          $localize`Diese E-Mail-Adresse gehört bereits zu einem anderen Konto. Bitte die Administration kontaktieren.`
        );
        break;
      case 'DOCPOUCH_UNAVAILABLE':
      case 'DOCPOUCH_RATE_LIMITED':
        this.snackBarService.openSnackBar(
          $localize`DocPouch ist derzeit nicht erreichbar. Bitte später erneut versuchen.`
        );
        break;
      default:
        this.snackBarService.openSnackBar(
          $localize`Anmeldung fehlgeschlagen.`
        );
    }
  }
}
