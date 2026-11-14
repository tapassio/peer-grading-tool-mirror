import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testCampaign, testGroup } from '../../testing/test-helpers';
import { GroupComponent } from './group.component';

describe('GroupComponent', () => {
  let component: GroupComponent;
  let fixture: ComponentFixture<GroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, GroupComponent],
    providers: [],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(GroupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaign', testCampaign());
    fixture.componentRef.setInput('group', testGroup());
    fixture.componentRef.setInput('campaignStatus', 'erstellt' as any);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
