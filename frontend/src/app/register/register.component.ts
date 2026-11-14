import { Component, WritableSignal, signal, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { SnackBarService } from '../services/snack-bar.service';
import { FormErrorComponent } from '../form-error/form-error.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'pgt-register',
    templateUrl: './register.component.html',
    styleUrl: './register.component.css',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [ReactiveFormsModule, FormErrorComponent, MatButton, MatIcon]
})
export class RegisterComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  userService = inject(UserService);
  private snackBarService = inject(SnackBarService);
  private router = inject(Router);

  registerForm: FormGroup;
  sent: WritableSignal<boolean> = signal(false);

  /**
   * upon initialization the registerForm is built
   */
  ngOnInit(): void {
    this.registerForm = this.formBuilder.group(
      {
        firstName: [null, Validators.required],
        lastName: [null, Validators.required],
        company: [null],
        email: [null, [Validators.required, Validators.email]],
        emailRepeat: [null, [Validators.required, Validators.email]],
        password: [null, [Validators.required, Validators.minLength(8)]],
        passwordRepeat: [null, Validators.required],
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
    const pass = group.get('password')?.value;
    const passRepeat = group.get('passwordRepeat')?.value;
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
    const email = group.get('email')?.value;
    const confirmEmail = group.get('emailRepeat')?.value;
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
