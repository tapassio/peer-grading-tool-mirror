import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { User } from '../interfaces';
import { UserService } from '../services/user.service';
import { SnackBarService } from '../services/snack-bar.service';
import { HttpErrorResponse } from '@angular/common/http';
/**
 * the profile component displays user data of admin users
 * here the password can be changed
 */
@Component({
    selector: 'pgt-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['../app.component.css', './profile.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProfileComponent implements OnInit {
  user: User | null | undefined;
  changePasswordForm: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private snackBarService: SnackBarService,
    public userService: UserService
  ) {}

  /**
   * the password form is built when the component loads
   */
  ngOnInit(): void {
    this.userService.getUser().subscribe({
      next: (user) => {
        this.user = user;
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        this.router.navigate(['/admin-dashboard']);
      },
    });
    this.changePasswordForm = this.formBuilder.group(
      {
        newPassword: [, [Validators.required, Validators.minLength(8)]],
        passwordRepeat: [, Validators.required],
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
    let pass = group.get('newPassword')?.value;
    let confirmPass = group.get('passwordRepeat')?.value;
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
        userId: this.user?.userId,
      };
    }
    let update = this.userService.changeUserPW(updateAdmin).subscribe({
      next: (res) => {
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
