import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateAdminUserComponent } from './create-admin-user.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormErrorComponent } from '../form-error/form-error.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('CreateUserComponent', () => {
  let component: CreateAdminUserComponent;
  let fixture: ComponentFixture<CreateAdminUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [CreateAdminUserComponent, FormErrorComponent],
    imports: [FormsModule,
        ReactiveFormsModule,
        MatSnackBarModule,
        RouterModule.forRoot([]),
        MatIconModule],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())]
}).compileComponents();

    fixture = TestBed.createComponent(CreateAdminUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
