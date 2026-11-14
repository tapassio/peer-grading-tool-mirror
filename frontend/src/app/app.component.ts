import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';

@Component({
    selector: 'pgt-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterOutlet, HeaderComponent]
})
export class AppComponent implements OnInit {
  router = inject(Router);
  private title = inject(Title);


  ngOnInit() {
    this.title.setTitle('Peer Grading Tool');
  }
}
