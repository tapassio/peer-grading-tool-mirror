import { Component, Signal, WritableSignal, signal, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { UserService } from '../services/user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SnackBarService } from '../services/snack-bar.service';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'pgt-confirm-email',
    templateUrl: './confirm-email.component.html',
    styleUrl: './confirm-email.component.css',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatIcon]
})
export class ConfirmEmailComponent implements OnInit {
  private router = inject(Router);
  userService = inject(UserService);
  private activatedRoute = inject(ActivatedRoute);
  private snackBarService = inject(SnackBarService);

  registerToken: Signal<string> = signal(
    this.activatedRoute.snapshot.params['token']
  );
  responseMessage: WritableSignal<any | undefined> = signal(undefined);

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
