import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testCampaign } from '../../testing/test-helpers';
import { CriteriaComponent } from './criteria.component';

describe('CriteriaComponent', () => {
  let component: CriteriaComponent;
  let fixture: ComponentFixture<CriteriaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, CriteriaComponent],
    providers: [],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(CriteriaComponent);
    component = fixture.componentInstance;
    component.campaign = testCampaign();
    component.campaignStatus = 'erstellt' as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
