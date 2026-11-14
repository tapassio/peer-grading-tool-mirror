import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
/**
 * this component is a page explaining the PGT
 */
@Component({
    selector: 'pgt-about',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatIcon]
})
export class AboutComponent {
  private router = inject(Router);


  backToLogin() {
    this.router.navigate(['/login']);
  }
}
