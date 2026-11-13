import { Component, WritableSignal, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { SnackBarService } from '../services/snack-bar.service';

@Component({
  selector: 'pgt-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  registerForm: FormGroup;
  sent: WritableSignal<boolean> = signal(false);

  constructor(
    private formBuilder: FormBuilder,
    public userService: UserService,
    private snackBarService: SnackBarService,
    private router: Router
  ) {}

  /**
   * upon initialization the registerForm is built
   */
  ngOnInit(): void {
    this.registerForm = this.formBuilder.group(
      {
        firstName: [, Validators.required],
        lastName: [, Validators.required],
        company: [,],
        email: [, [Validators.required, Validators.email]],
        emailRepeat: [, [Validators.required, Validators.email]],
        password: [, [Validators.required, Validators.minLength(8)]],
        passwordRepeat: [, Validators.required],
      },
      { validators: [this.checkEmails, this.checkPasswords] }
    );
  }

  /**
   * this validator checks if the two emails are the same
   * @param group
   * @returns
   */
  checkPasswords: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    let pass = group.get('password')?.value;
    let passRepeat = group.get('passwordRepeat')?.value;
    return pass === passRepeat ? null : { notSame: true };
  };

  /**
   * this validator checks if the two emails are the same
   * @param group
   * @returns
   */
  checkEmails: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    let email = group.get('email')?.value;
    let confirmEmail = group.get('emailRepeat')?.value;
    return email === confirmEmail ? null : { emailsNotSame: true };
  };

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  /**
   * this function is used when the register button is clicked
   * @param registerForm
   */
  register(registerForm: FormGroup) {
    if (registerForm.valid) {
      this.userService.register(registerForm.value).subscribe({
        next: () => {
          this.snackBarService.openSnackBar(
            $localize`Daten gesendet. Sie sollten eine E-Mail erhalten.`
          );
          this.sent.set(true);
        },
        error: (error) => {
          this.snackBarService.openErrorBar(error);
        },
      });
      // register via loginService
    } else {
      registerForm.markAllAsTouched();
    }
  }
}
