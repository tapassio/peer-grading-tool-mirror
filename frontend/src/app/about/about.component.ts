import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
/**
 * this component is a page explaining the PGT
 */
@Component({
    selector: 'pgt-about',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AboutComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {}

  backToLogin() {
    this.router.navigate(['/login']);
  }
}
