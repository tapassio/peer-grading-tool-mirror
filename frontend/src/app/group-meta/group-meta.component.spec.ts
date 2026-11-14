import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testCampaign, testGroup } from '../testing/test-helpers';
import { GroupMetaComponent } from './group-meta.component';

describe('GroupMetaComponent', () => {
  let component: GroupMetaComponent;
  let fixture: ComponentFixture<GroupMetaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, GroupMetaComponent],
    providers: [],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(GroupMetaComponent);
    component = fixture.componentInstance;
    component.campaign = testCampaign();
    component.group = testGroup();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
