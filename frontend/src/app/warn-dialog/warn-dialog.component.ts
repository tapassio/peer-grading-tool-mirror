import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
/**
 * this component displays a dialog box that warns the user before certain actions
 */
@Component({
    selector: 'pgt-warnung',
    templateUrl: './warn-dialog.component.html',
    styleUrls: ['./warn-dialog.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class WarnDialogComponent implements OnInit {
  title: string = this.data.title || $localize`Warnung!`;
  affirmButton: string = this.data.affirmButton || $localize`Löschen`;
  cancelButton: string = this.data.cancelButton || $localize`Abbrechen`;

  constructor(
    public dialogRef: MatDialogRef<WarnDialogComponent>,

    @Inject(MAT_DIALOG_DATA)
    public data: {
      text: string;
      affirmButton?: string;
      cancelButton?: string;
      title?: string;
    }
  ) {}

  ngOnInit(): void {}
}
