import { Component, Signal, WritableSignal, signal, ChangeDetectionStrategy } from '@angular/core';
import { UserService } from '../services/user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SnackBarService } from '../services/snack-bar.service';

@Component({
    selector: 'pgt-confirm-email',
    templateUrl: './confirm-email.component.html',
    styleUrl: './confirm-email.component.css',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ConfirmEmailComponent {
  registerToken: Signal<string> = signal(
    this.activatedRoute.snapshot.params['token']
  );
  responseMessage: WritableSignal<any | undefined> = signal(undefined);

  constructor(
    private router: Router,
    public userService: UserService,
    private activatedRoute: ActivatedRoute,
    private snackBarService: SnackBarService
  ) {}

  /**
   * upon initialization the url is used to confirm the email adress in the backend
   */
  ngOnInit(): void {
    this.userService.confirmEmail(this.registerToken()).subscribe({
      next: (res: any) => {
        this.responseMessage.set(res);
      },
      error: (error) => {
        this.responseMessage.set(false);
        this.snackBarService.openErrorBar(error);
      },
    });
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
