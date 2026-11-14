import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testCampaign } from '../testing/test-helpers';
import { CampaignButtonsComponent } from './campaign-buttons.component';

describe('CampaignButtonsComponent', () => {
  let component: CampaignButtonsComponent;
  let fixture: ComponentFixture<CampaignButtonsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, CampaignButtonsComponent],
    providers: [],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(CampaignButtonsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaign', testCampaign());
    fixture.componentRef.setInput('viewState', 'dashboard');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
