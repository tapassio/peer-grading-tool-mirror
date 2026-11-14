import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupCommentsComponent } from './group-comments.component';

describe('GroupCommentsComponent', () => {
  let component: GroupCommentsComponent;
  let fixture: ComponentFixture<GroupCommentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [GroupCommentsComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(GroupCommentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('comments', []);
    fixture.componentRef.setInput('peers', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
