import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
/**
 * this component displays a dialog box that warns the user before certain actions
 */
@Component({
    selector: 'pgt-warnung',
    templateUrl: './warn-dialog.component.html',
    styleUrls: ['./warn-dialog.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatDialogActions, MatButton, MatDialogClose, MatIcon]
})
export class WarnDialogComponent {
  dialogRef = inject<MatDialogRef<WarnDialogComponent>>(MatDialogRef);
  data = inject<{
    text: string;
    affirmButton?: string;
    cancelButton?: string;
    title?: string;
}>(MAT_DIALOG_DATA);

  title: string = this.data.title || $localize`Warnung!`;
  affirmButton: string = this.data.affirmButton || $localize`Löschen`;
  cancelButton: string = this.data.cancelButton || $localize`Abbrechen`;

}
