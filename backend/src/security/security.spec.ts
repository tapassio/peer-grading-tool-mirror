// no database needed
jest.mock('../prisma.service', () => ({ PrismaService: class {} }));

import { AppService } from '../app.service';
import { checkSecrets } from './check-secrets';
import { CampaignGuard } from '../guards/campaign.guard';

describe('AppService.generateLink', () => {
  const service = new AppService();

  it('creates long random links', () => {
    const a = service.generateLink(1, 1);
    const b = service.generateLink(1, 1);
    expect(a).not.toEqual(b); // not derived from the ids anymore
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // safe inside a URL
  });
});

describe('checkSecrets', () => {
  const backup = { ...process.env };
  afterEach(() => (process.env = { ...backup }));

  const strong = (c: string) => c.repeat(40);

  it('fails in production with the example secrets', () => {
    process.env.JWT_SECRET = 'secretKey';
    process.env.JWT_REFRESH_SECRET = 'refreshSecretKey';
    process.env.JWT_REGISTRATION_SECRET = 'registrationSecretKey';
    expect(() => checkSecrets(true)).toThrow(/Insecure configuration/);
  });

  it('fails in production when secrets are equal', () => {
    process.env.JWT_SECRET = strong('a');
    process.env.JWT_REFRESH_SECRET = strong('a');
    process.env.JWT_REGISTRATION_SECRET = strong('b');
    expect(() => checkSecrets(true)).toThrow(/different/);
  });

  it('passes with strong, different secrets', () => {
    process.env.JWT_SECRET = strong('a');
    process.env.JWT_REFRESH_SECRET = strong('b');
    process.env.JWT_REGISTRATION_SECRET = strong('c');
    expect(() => checkSecrets(true)).not.toThrow();
  });

  it('only warns in development', () => {
    delete process.env.JWT_SECRET;
    expect(() => checkSecrets(false)).not.toThrow();
  });
});

describe('CampaignGuard', () => {
  const context = (req: any) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) } as any);

  const guardWith = (found: boolean) => {
    const prisma: any = {
      campaign: {
        findFirst: jest.fn().mockResolvedValue(found ? { campaignId: 5 } : null),
      },
    };
    return { guard: new CampaignGuard(prisma), prisma };
  };

  it('allows own campaign', async () => {
    const { guard, prisma } = guardWith(true);
    const ok = await guard.canActivate(
      context({ user: { email: 'a@b.c' }, method: 'GET', params: { id: '5' } }),
    );
    expect(ok).toBe(true);
    expect(prisma.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId: 5, users: { some: { email: 'a@b.c' } } },
      }),
    );
  });

  it('denies foreign campaign', async () => {
    const { guard } = guardWith(false);
    await expect(
      guard.canActivate(
        context({ user: { email: 'a@b.c' }, method: 'DELETE', params: { id: '7' } }),
      ),
    ).resolves.toBe(false);
  });

  it('denies campaignId 0 and unknown methods', async () => {
    const { guard } = guardWith(true);
    await expect(
      guard.canActivate(
        context({ user: { email: 'a@b.c' }, method: 'POST', body: { campaignId: 0 } }),
      ),
    ).resolves.toBe(false);
    await expect(
      guard.canActivate(
        context({ user: { email: 'a@b.c' }, method: 'PUT', body: {} }),
      ),
    ).resolves.toBe(false);
  });
});
