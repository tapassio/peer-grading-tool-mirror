import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PeerGradingReviewComponent } from './grading-review.component';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('PeerGradingReviewComponent', () => {
  let component: PeerGradingReviewComponent;
  let fixture: ComponentFixture<PeerGradingReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [PeerGradingReviewComponent],
    imports: [MatSnackBarModule, RouterModule.forRoot([])],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())]
}).compileComponents();

    fixture = TestBed.createComponent(PeerGradingReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
