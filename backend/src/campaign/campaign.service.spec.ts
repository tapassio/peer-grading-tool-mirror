import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from '../app.service';
import { CalculationsService } from '../calculations/calculations.service';
import { PrismaService } from '../prisma.service';
import { SendgridService } from '../sendgrid/sendgrid.service';
import { CampaignService } from './campaign.service';

// no database and no e-mails: all dependencies are replaced
jest.mock('../prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../sendgrid/sendgrid.service');

describe('CampaignService', () => {
  let service: CampaignService;
  const prisma = { campaign: { findMany: jest.fn().mockResolvedValue([]) } };

  beforeEach(async () => {
    prisma.campaign.findMany.mockClear();
    const app: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        SendgridService,
        AppService,
        CalculationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = app.get(CampaignService);
  });

  describe('getCampaignsByUser', () => {
    it('only returns the campaigns of the given lecturer', async () => {
      await service.getCampaignsByUser('lea@example.org');
      const query = prisma.campaign.findMany.mock.calls[0][0];
      expect(query.where).toEqual({
        users: { some: { email: 'lea@example.org' } },
      });
    });

    it('includes criteria, peers and gradings (needed by the statistics page)', async () => {
      await service.getCampaignsByUser('lea@example.org');
      const query = prisma.campaign.findMany.mock.calls[0][0];
      expect(query.include.criteria).toBe(true);
      expect(query.include.groups.include.gradings).toBe(true);
      expect(query.include.groups.include.peers.include.peer).toBe(true);
    });
  });
});
