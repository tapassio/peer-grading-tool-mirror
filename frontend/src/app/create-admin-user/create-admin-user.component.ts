import {
  Component,
  OnInit,
  WritableSignal,
  effect,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '../interfaces';
import { SuperService } from '../services/super.service';
import { SnackBarService } from '../services/snack-bar.service';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * this component is only accessible for super users
 * admin users can be created or edited
 */
@Component({
  selector: 'pgt-create-user',
  templateUrl: './create-admin-user.component.html',
  styleUrls: ['./create-admin-user.component.css'],
})
export class CreateAdminUserComponent implements OnInit {
  userId: WritableSignal<number> = signal(
    this.activatedRoute.snapshot.params['id']
  );
  admin: WritableSignal<User | null> = signal(null);
  adminForm: FormGroup;

  adminChange = effect(() => {
    if (this.admin() != null) {
      this.adminForm.patchValue({
        adminFirstName: (this.admin() as User).firstName,
        adminLastName: (this.admin() as User).lastName,
        adminEmail: (this.admin() as User).email,
        adminCompany: (this.admin() as User).company,
      });

      this.adminForm.controls['adminPW'].removeValidators(Validators.required);
      this.adminForm.controls['adminPWRepeat'].removeValidators(
        Validators.required
      );

      this.adminForm.controls['adminPW'].updateValueAndValidity();
      this.adminForm.controls['adminPWRepeat'].updateValueAndValidity();
    }
  });

  constructor(
    private formBuilder: FormBuilder,
    private adminService: SuperService,
    private router: Router,
    private snackBarService: SnackBarService,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // building admin form
    this.adminForm = this.formBuilder.group(
      {
        adminFirstName: ['', Validators.required],
        adminLastName: ['', Validators.required],
        adminCompany: [],
        adminEmail: [
          '',
          [
            Validators.required,
            Validators.pattern(
              '([a-zA-Z0-9_\\-\\.]+)@([a-zA-Z0-9_\\-\\.]+)\\.([a-zA-Z]{2,5})'
            ),
          ],
        ],
        adminPW: ['', [Validators.required, Validators.minLength(8)]],
        adminPWRepeat: ['', Validators.required],
      },
      { validators: this.checkPasswords }
    );

    // trying to get admin user if there is an id in the route
    if (this.userId()) {
      this.adminService.getAdminById(this.userId()).subscribe({
        next: (admin: User | null) => {
          this.admin.set(admin);
        },
        error: (error: HttpErrorResponse) => {
          this.snackBarService.openErrorBar(error);
          if (error.status != null && error.status == 403) {
            this.router.navigate(['/admin-dashboard']);
          } else {
            this.router.navigate(['/user-list']);
          }
        },
      });
    }
  }

  /**
   * this validator checks if the passwords entered are the same
   * @param group the formgroup containing the entered passwords
   * @returns null if the check succeeds or an object if not
   */
  checkPasswords: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    let pass = group.get('adminPW')?.value;
    let confirmPass = group.get('adminPWRepeat')?.value;
    return pass === confirmPass ? null : { notSame: true };
  };

  /**
   * checks if the admin already existed and sets the password text accordingly
   * @returns the password label text
   */
  getPasswordText() {
    if (this.admin() != null) return $localize`Neues Passwort`;
    return $localize`Passwort`;
  }

  /**
   * checks if the admin already existed and sets the password repeat text accordingly
   * @returns the password repeat text
   */
  getPasswordRepeatText() {
    if (this.admin() != null) return $localize`Neues Passwort wiederholen`;
    return $localize`Passwort wiederholen`;
  }

  /**
   * creates new admin (used in html)
   * @param adminForm
   */
  createAdmin(adminForm: FormGroup) {
    const admin = {
      email: adminForm.value.adminEmail.trim(),
      firstName: adminForm.value.adminFirstName.trim(),
      lastName: adminForm.value.adminLastName.trim(),
      company: adminForm.value.adminCompany
        ? adminForm.value.adminCompany
        : undefined,
      password: adminForm.value.adminPW,
    };

    this.adminService.createAdmin(admin).subscribe({
      next: (res: User) => {
        this.router.navigate(['user-list']);
        this.snackBarService.openSnackBar(
          $localize`Admin ${admin.firstName} ${admin.lastName} gespeichert.`
        );
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        if (error.status != null && error.status == 403) {
          this.router.navigate(['/admin-dashboard']);
        }
      },
    });
  }

  /**
   * updates exisiting admin (used in html)
   * @param adminForm
   */
  updateAdmin(adminForm: FormGroup) {
    let updateAdmin: any = {
      email: adminForm.value.adminEmail,
      firstName: adminForm.value.adminFirstName,
      lastName: adminForm.value.adminLastName,
      company: adminForm.value.adminCompany,
      userId: this.admin()?.userId,
    };
    if (adminForm.value.adminPW != null && adminForm.value.adminPW != '')
      updateAdmin['password'] = adminForm.value.adminPW;
    let update = this.adminService.updateAdmin(updateAdmin).subscribe({
      next: (res) => {
        if (res == null) {
          this.snackBarService.openSnackBar(
            $localize`Speichern fehlgeschlagen`
          );
        } else {
          update.unsubscribe();
          this.router.navigate(['/user-list']);
          this.snackBarService.openSnackBar($localize`Änderungen gespeichert`);
        }
      },
      error: (error: HttpErrorResponse) => {
        if (error.status != null && error.status == 403) {
          this.snackBarService.openErrorBar(error);
          this.router.navigate(['/admin-dashboard']);
        }
        this.snackBarService.openSnackBar(
          $localize`Benutzer konnte nicht gespeichert werden.` +
            ' ' +
            $localize`Fehlermeldung: ${error.message}`
        );
      },
    });
  }
}
