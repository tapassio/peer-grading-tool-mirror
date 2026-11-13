import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testPeer, testUser } from '../../testing/test-helpers';
import { FormControl, FormGroup } from '@angular/forms';
import { SingleCommentComponent } from './single-comment.component';

describe('SingleCommentComponent', () => {
  let component: SingleCommentComponent;
  let fixture: ComponentFixture<SingleCommentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...testImports],
      declarations: [SingleCommentComponent],
      providers: [],
      schemas: testSchemas,
    }).compileComponents();

    fixture = TestBed.createComponent(SingleCommentComponent);
    component = fixture.componentInstance;
    const user = testUser();
    component.toUser = user;
    component.peer = testPeer();
    component.commentFormGroup = new FormGroup({ [user.userId]: new FormControl('') });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
