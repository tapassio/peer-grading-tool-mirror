import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas } from '../testing/test-helpers';
import { MatMenuModule } from '@angular/material/menu';
import { LanguageSwitchComponent } from './language-switch.component';

describe('LanguageSwitchComponent', () => {
  let component: LanguageSwitchComponent;
  let fixture: ComponentFixture<LanguageSwitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...testImports, MatMenuModule],
      declarations: [LanguageSwitchComponent],
      providers: [],
      schemas: testSchemas,
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
