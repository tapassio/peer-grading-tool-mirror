import { ForbiddenException } from '@nestjs/common';

// no real database: services are replaced, Prisma is a small in-memory fake
jest.mock('../prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../sendgrid/sendgrid.service', () => ({
  SendgridService: class {},
}));

import { UserService } from './user.service';

type Row = {
  userId: number;
  email: string;
  docPouchId: string | null;
  roles: string[];
};

function fakePrisma(rows: Row[]) {
  const roleIds: Record<string, number> = { ADMIN: 1, SUPER: 2, PEER: 3 };
  const roleName = (id: number) =>
    Object.keys(roleIds).find((k) => roleIds[k] === id)!;
  const withRoles = (r?: Row) =>
    r && { ...r, roles: r.roles.map((role) => ({ role })) };
  let nextId = 100;
  return {
    rows,
    role: {
      findFirst: async ({ where }: any) => ({
        roleId: roleIds[where.role],
        role: where.role,
      }),
      create: async () => {
        throw new Error('not expected');
      },
    },
    user: {
      findUnique: async ({ where }: any) =>
        withRoles(
          rows.find((r) =>
            where.docPouchId !== undefined
              ? r.docPouchId === where.docPouchId
              : r.email === where.email,
          ),
        ),
      findFirst: async ({ where }: any) =>
        withRoles(
          rows.find(
            (r) =>
              r.email === where.email &&
              r.docPouchId === where.docPouchId &&
              r.roles.some((role) => where.roles.some.role.in.includes(role)),
          ),
        ),
      create: async ({ data }: any) => {
        rows.push({
          userId: nextId++,
          email: data.email,
          docPouchId: data.docPouchId,
          roles: data.roles.connect.map((c: any) => roleName(c.roleId)),
        });
      },
      update: async ({ where, data }: any) => {
        const r = rows.find((x) => x.userId === where.userId)!;
        Object.assign(r, {
          email: data.email,
          docPouchId: data.docPouchId,
          roles: data.roles.set.map((c: any) => roleName(c.roleId)),
        });
      },
    },
  };
}

function service(rows: Row[]) {
  const prisma = fakePrisma(rows);
  const s = new UserService(prisma as any, {} as any);
  // getUser is tested elsewhere; here it returns the row
  (s as any).getUser = async (email: string) =>
    rows.find((r) => r.email === email);
  return { s, rows };
}

const admin = (email: string, id = 'dp-1') => ({
  _id: id,
  email,
  name: 'Ada Lovelace',
  role: 'admin',
  isAdmin: false,
});

describe('UserService.upsertOidcUser (linking DocPouch accounts)', () => {
  it('links an existing local lecturer by e-mail on the first login', async () => {
    const { s, rows } = service([
      { userId: 1, email: 'ada@bfh.ch', docPouchId: null, roles: ['ADMIN'] },
    ]);
    await s.upsertOidcUser(admin('ada@bfh.ch'));
    expect(rows).toHaveLength(1);
    expect(rows[0].docPouchId).toBe('dp-1');
  });

  it('finds a linked account by DocPouch id, also after an e-mail change', async () => {
    const { s, rows } = service([
      { userId: 1, email: 'old@bfh.ch', docPouchId: 'dp-1', roles: ['ADMIN'] },
    ]);
    await s.upsertOidcUser(admin('new@bfh.ch'));
    expect(rows[0].email).toBe('new@bfh.ch');
  });

  it('does NOT take over a student (peer) account with the same e-mail', async () => {
    const { s, rows } = service([
      { userId: 1, email: 'student@bfh.ch', docPouchId: null, roles: ['PEER'] },
    ]);
    await expect(s.upsertOidcUser(admin('student@bfh.ch'))).rejects.toThrow(
      'DOCPOUCH_EMAIL_IN_USE',
    );
    expect(rows[0]).toEqual({
      userId: 1,
      email: 'student@bfh.ch',
      docPouchId: null,
      roles: ['PEER'],
    });
  });

  it('does NOT take over an account linked to another DocPouch id', async () => {
    const { s, rows } = service([
      {
        userId: 1,
        email: 'ada@bfh.ch',
        docPouchId: 'dp-OTHER',
        roles: ['ADMIN'],
      },
    ]);
    await expect(s.upsertOidcUser(admin('ada@bfh.ch'))).rejects.toThrow(
      'DOCPOUCH_EMAIL_IN_USE',
    );
    expect(rows[0].docPouchId).toBe('dp-OTHER');
  });

  it('keeps the PEER role of a lecturer who is also a student', async () => {
    const { s, rows } = service([
      {
        userId: 1,
        email: 'ada@bfh.ch',
        docPouchId: 'dp-1',
        roles: ['ADMIN', 'PEER'],
      },
    ]);
    await s.upsertOidcUser({ ...admin('ada@bfh.ch'), role: 'superadmin' });
    expect(rows[0].roles.sort()).toEqual(['ADMIN', 'PEER', 'SUPER']);
  });

  it('keeps the old e-mail when the new one belongs to another account', async () => {
    const { s, rows } = service([
      { userId: 1, email: 'old@bfh.ch', docPouchId: 'dp-1', roles: ['ADMIN'] },
      { userId: 2, email: 'taken@bfh.ch', docPouchId: null, roles: ['PEER'] },
    ]);
    await s.upsertOidcUser(admin('taken@bfh.ch'));
    expect(rows[0].email).toBe('old@bfh.ch');
    expect(rows[1].roles).toEqual(['PEER']);
  });

  it('creates a new account when nothing matches', async () => {
    const { s, rows } = service([]);
    await s.upsertOidcUser(admin('new@bfh.ch'));
    expect(rows).toEqual([
      expect.objectContaining({
        email: 'new@bfh.ch',
        docPouchId: 'dp-1',
        roles: ['ADMIN'],
      }),
    ]);
  });

  it('refuses DocPouch members', async () => {
    const { s } = service([]);
    await expect(
      s.upsertOidcUser({ ...admin('m@bfh.ch'), role: 'member' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
