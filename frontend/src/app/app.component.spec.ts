import { TestBed } from '@angular/core/testing';
import { testImports, testSchemas } from './testing/test-helpers';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, AppComponent],
    schemas: testSchemas,
}).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the app frame with footer (Toolchain design)', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.app-container')).toBeTruthy();
    expect(el.querySelector('.app-footer')?.textContent).toContain('Toolchain');
  });
});
