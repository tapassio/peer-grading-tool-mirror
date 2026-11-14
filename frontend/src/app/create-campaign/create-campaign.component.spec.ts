import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateCampaignComponent } from './create-campaign.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { FormErrorComponent } from '../form-error/form-error.component';
import { CriteriaComponent } from './criteria/criteria.component';
import { MatIconModule } from '@angular/material/icon';
import { ToolTipComponent } from '../tool-tip/tool-tip.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('CreateCampaignComponent', () => {
  let component: CreateCampaignComponent;
  let fixture: ComponentFixture<CreateCampaignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [
        CreateCampaignComponent,
        FormErrorComponent,
        CriteriaComponent,
        ToolTipComponent,
    ],
    imports: [FormsModule,
        ReactiveFormsModule,
        RouterModule.forRoot([]),
        MatSnackBarModule,
        MatDialogModule,
        MatIconModule,
        MatTooltipModule,
        MatSlideToggleModule,
        NoopAnimationsModule],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())]
}).compileComponents();

    fixture = TestBed.createComponent(CreateCampaignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
