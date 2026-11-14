import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CampaignGroupSummaryComponent } from './campaign-group-summary.component';

describe('CampaignGroupSummaryComponent', () => {
  let component: CampaignGroupSummaryComponent;
  let fixture: ComponentFixture<CampaignGroupSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [CampaignGroupSummaryComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(CampaignGroupSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
