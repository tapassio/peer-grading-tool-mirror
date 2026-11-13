import { TestBed } from '@angular/core/testing';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { DeactivatableComponent } from '../interfaces';
import { pendingChangesGuard } from './pending-changes.guard';

describe('pendingChangesGuard', () => {
  const dialog = { open: jest.fn() };
  const run: CanDeactivateFn<DeactivatableComponent> = (...args) =>
    TestBed.runInInjectionContext(() => pendingChangesGuard(...args));

  beforeEach(() => {
    dialog.open.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialog, useValue: dialog }],
    });
  });

  const call = (component: DeactivatableComponent) =>
    run(component, null as any, null as any, null as any);

  it('lets you leave without unsaved changes', () => {
    expect(call({ canDeactivate: () => true })).toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('asks before leaving with unsaved changes', (done) => {
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const result: any = call({ canDeactivate: () => false });
    expect(dialog.open).toHaveBeenCalled();
    // closing the dialog without a choice means: stay
    result.subscribe((value: boolean) => {
      expect(value).toBe(false);
      done();
    });
  });
});
