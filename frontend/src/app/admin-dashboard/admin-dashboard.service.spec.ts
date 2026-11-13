import { TestBed } from '@angular/core/testing';
import { testImports } from '../testing/test-helpers';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: testImports });
    service = TestBed.inject(AdminDashboardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
