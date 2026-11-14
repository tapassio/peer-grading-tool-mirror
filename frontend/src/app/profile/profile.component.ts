import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ValidatorFn, AbstractControl, ValidationErrors, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { User } from '../interfaces';
import { UserService } from '../services/user.service';
import { SnackBarService } from '../services/snack-bar.service';
import { HttpErrorResponse } from '@angular/common/http';
import { FormErrorComponent } from '../form-error/form-error.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
/**
 * the profile component displays user data of admin users
 * here the password can be changed
 */
@Component({
    selector: 'pgt-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['../app.component.css', './profile.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, FormErrorComponent, MatButton, MatIcon]
})
export class ProfileComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private snackBarService = inject(SnackBarService);
  userService = inject(UserService);

  readonly user = signal<User | null | undefined>(undefined);
  changePasswordForm: FormGroup;

  /**
   * the password form is built when the component loads
   */
  ngOnInit(): void {
    this.userService.getUser().subscribe({
      next: (user) => {
        this.user.set(user);
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        this.router.navigate(['/admin-dashboard']);
      },
    });
    this.changePasswordForm = this.formBuilder.group(
      {
        newPassword: [null, [Validators.required, Validators.minLength(8)]],
        passwordRepeat: [null, Validators.required],
      },
      { validators: this.checkPasswords }
    );
  }

  /**
   * this validator checks if the two passwords are the same
   * @param group
   * @returns
   */
  checkPasswords: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    const pass = group.get('newPassword')?.value;
    const confirmPass = group.get('passwordRepeat')?.value;
    return pass === confirmPass ? null : { notSame: true };
  };

  /**
   * this function is called when clicking the button in the html
   * @param changePasswordForm
   */
  changePassword(changePasswordForm: FormGroup) {
    let updateAdmin;
    if (
      changePasswordForm.value.newPassword != null ||
      changePasswordForm.value.newPassword != ''
    ) {
      updateAdmin = {
        password: changePasswordForm.value.newPassword,
      };
    } else {
      updateAdmin = {
        userId: this.user()?.userId,
      };
    }
    const update = this.userService.changeUserPW(updateAdmin).subscribe({
      next: () => {
        update.unsubscribe();
        this.router.navigate(['/admin-dashboard']);
        this.snackBarService.openSnackBar($localize`Änderungen gespeichert`);
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openSnackBar(
          $localize`Passwort konnte nicht geändert werden.` +
            ` ` +
            $localize`Fehlermeldung: ${error.message}`
        );
      },
    });
  }
}
