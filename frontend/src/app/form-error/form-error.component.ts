import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormControl } from '@angular/forms';

@Component({
    selector: 'pgt-form-error',
    templateUrl: './form-error.component.html',
    styleUrls: ['./form-error.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class FormErrorComponent implements OnInit {

  @Input() control:FormControl | any;

  constructor() { }

  ngOnInit(): void {
  }

}
