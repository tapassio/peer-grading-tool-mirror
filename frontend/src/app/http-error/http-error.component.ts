import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'pgt-http-error',
    templateUrl: './http-error.component.html',
    styleUrls: ['./http-error.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatIcon]
})
export class HttpErrorComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  status: string;

  ngOnInit(): void {
    this.activatedRoute.params.subscribe((params: Params) => {
      this.status = params['id'];
    });
  }

  toLogin() {
    this.router.navigate(['/login']);
  }

  goBack() {
    history.go(-2);
  }
}
