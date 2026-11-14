import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { FormControl } from '@angular/forms';

@Component({
    selector: 'pgt-form-error',
    templateUrl: './form-error.component.html',
    styleUrls: ['./form-error.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class FormErrorComponent {

  @Input() control:FormControl | any;

}
