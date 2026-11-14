import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';

@Component({
    selector: 'pgt-http-error',
    templateUrl: './http-error.component.html',
    styleUrls: ['./http-error.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class HttpErrorComponent implements OnInit {
  status: string;

  constructor(private activatedRoute: ActivatedRoute, private router: Router) {}

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
