import { resolve } from 'path';
import { databaseUrl } from './database-url';

describe('databaseUrl (same SQLite file as with Prisma 4)', () => {
  it('relative paths are resolved against prisma/', () => {
    expect(databaseUrl('file:./dev.db')).toBe(
      `file:${resolve(process.cwd(), 'prisma', 'dev.db')}`,
    );
  });

  it('absolute paths stay as they are (Docker: file:/dev.db)', () => {
    expect(databaseUrl('file:/dev.db')).toBe('file:/dev.db');
  });

  it('default is prisma/dev.db', () => {
    expect(databaseUrl('')).toBe(
      `file:${resolve(process.cwd(), 'prisma', 'dev.db')}`,
    );
  });

  it('in-memory database', () => {
    expect(databaseUrl('file::memory:')).toBe('file::memory:');
  });
});
