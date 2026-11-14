import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class SnackBarService {
  constructor(private snackBar: MatSnackBar) {}

  /**
   * the snackbar is used to show a user that an action has taken place or an error occured
   * shown at the bottom of the screen
   * @param message
   * @param action
   */
  openSnackBar(
    message: string,
    action: string = $localize`Schliessen`,
    duration = 15000
  ) {
    this.snackBar.open(message, action, {
      duration: duration,
      panelClass: ['info-snackbar'],
    });
  }

  openErrorBar(
    error: HttpErrorResponse,
    action: string = $localize`Schliessen`,
    duration = 15000
  ) {
    const status = error.status;
    const message = error.error.message;
    const text = error.statusText;
    if (status && message) {
      this.openSnackBar(
        $localize`Fehler` + ` ${status}: ${message}`,
        action,
        duration
      );
    } else if (status && text) {
      this.openSnackBar(
        $localize`Fehler` + ` ${status}: ${text}`,
        action,
        duration
      );
    } else {
      this.openSnackBar(
        $localize`Fehler` + ` : ${JSON.stringify(error)}`,
        action,
        duration
      );
    }
  }
}
