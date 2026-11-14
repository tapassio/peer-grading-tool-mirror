import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CampaignSummaryComponent } from './campaign-summary.component';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('CampaignSummaryComponent', () => {
  let component: CampaignSummaryComponent;
  let fixture: ComponentFixture<CampaignSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [MatSnackBarModule, RouterModule.forRoot([]), CampaignSummaryComponent],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())]
}).compileComponents();

    fixture = TestBed.createComponent(CampaignSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
