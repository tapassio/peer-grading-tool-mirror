import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CampaignGroupSummaryComponent } from './campaign-group-summary.component';
import { testCampaign, testGroup, testImports } from '../../testing/test-helpers';

describe('CampaignGroupSummaryComponent', () => {
  let component: CampaignGroupSummaryComponent;
  let fixture: ComponentFixture<CampaignGroupSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...testImports, CampaignGroupSummaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignGroupSummaryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaign', testCampaign());
    fixture.componentRef.setInput('group', testGroup());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the group number and a grade row', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Gruppe ' + testGroup().number);
    expect(text).toContain('Note');
  });
});
