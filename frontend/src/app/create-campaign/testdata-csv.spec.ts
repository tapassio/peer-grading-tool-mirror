import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CsvService } from './csv.service';

/**
 * The test data in /testdata must be importable with the normal CSV import.
 * Default group size 4; groups of 3 or 5 so that the class size works out.
 */
describe('test data CSV files', () => {
  let service: CsvService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CsvService);
  });

  const read = (file: string) =>
    readFileSync(join(__dirname, '..', '..', '..', '..', 'testdata', file), 'utf-8');

  it.each([
    ['klasse-a-47-studierende.csv', 47, 12, { 3: 1, 4: 11 }],
    ['klasse-b-34-studierende.csv', 34, 8, { 4: 6, 5: 2 }],
  ])('%s: %p students in %p groups', (file, students, groups, sizes) => {
    const result = service.generateGroupsByCSV(read(file));

    expect(service.csvErrors()).toEqual([]);
    expect(result).toHaveLength(groups);
    expect(result.reduce((n, g) => n + g.peers.length, 0)).toBe(students);

    const count: Record<number, number> = {};
    for (const g of result) count[g.peers.length] = (count[g.peers.length] ?? 0) + 1;
    expect(count).toEqual(sizes);
  });
});
