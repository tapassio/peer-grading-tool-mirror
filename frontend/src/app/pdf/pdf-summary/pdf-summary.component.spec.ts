import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfSummaryComponent } from './pdf-summary.component';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('PdfSummaryComponent', () => {
  let component: PdfSummaryComponent;
  let fixture: ComponentFixture<PdfSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [MatSnackBarModule, RouterModule.forRoot([]), PdfSummaryComponent],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())]
}).compileComponents();

    fixture = TestBed.createComponent(PdfSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
