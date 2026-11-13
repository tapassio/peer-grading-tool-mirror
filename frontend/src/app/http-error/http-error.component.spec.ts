import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas } from '../testing/test-helpers';
import { HttpErrorComponent } from './http-error.component';

describe('HttpErrorComponent', () => {
  let component: HttpErrorComponent;
  let fixture: ComponentFixture<HttpErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...testImports],
      declarations: [HttpErrorComponent],
      providers: [],
      schemas: testSchemas,
    }).compileComponents();

    fixture = TestBed.createComponent(HttpErrorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
