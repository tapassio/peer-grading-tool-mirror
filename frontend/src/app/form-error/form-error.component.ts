import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { FormControl } from '@angular/forms';

@Component({
    selector: 'pgt-form-error',
    templateUrl: './form-error.component.html',
    styleUrls: ['./form-error.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager
})
export class FormErrorComponent {

  readonly control = input<FormControl | any>();

}
