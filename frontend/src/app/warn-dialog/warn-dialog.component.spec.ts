import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas } from '../testing/test-helpers';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { WarnDialogComponent } from './warn-dialog.component';

describe('WarnDialogComponent', () => {
  let component: WarnDialogComponent;
  let fixture: ComponentFixture<WarnDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, WarnDialogComponent],
    providers: [
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: { text: 'Sicher?' } },
    ],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(WarnDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
