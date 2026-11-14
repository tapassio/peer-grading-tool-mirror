import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileComponent } from './profile.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('AdminPwComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [ProfileComponent],
    imports: [FormsModule,
        ReactiveFormsModule,
        MatSnackBarModule],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())]
}).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
