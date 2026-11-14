import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testCampaign } from '../testing/test-helpers';
import { CampaignStatusPipe } from '../pipes/campaign-status.pipe';
import { CampaignMetaComponent } from './campaign-meta.component';

describe('CampaignMetaComponent', () => {
  let component: CampaignMetaComponent;
  let fixture: ComponentFixture<CampaignMetaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, CampaignMetaComponent, CampaignStatusPipe],
    providers: [],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(CampaignMetaComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaign', testCampaign());
    fixture.componentRef.setInput('viewState', 'dashboard');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
