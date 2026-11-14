import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testCampaign, testGradingsForm } from '../../testing/test-helpers';
import { GradingComponent } from '../grading.component';
import { SingleRowComponent } from './single-row.component';

describe('SingleRowComponent', () => {
  let component: SingleRowComponent;
  let fixture: ComponentFixture<SingleRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, SingleRowComponent],
    providers: [
        // the row asks the grading page for the entered points
        { provide: GradingComponent, useValue: { generateGradings: () => [] } },
    ],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(SingleRowComponent);
    component = fixture.componentInstance;
    const campaign = testCampaign();
    const peers = campaign.groups[0].peers;
    component.campaign = campaign;
    component.peer = peers[0];
    component.toPeer = peers[1];
    component.gradingsFormGroup = testGradingsForm(campaign, peers);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
