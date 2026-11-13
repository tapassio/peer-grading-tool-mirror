import { BadRequestException, NotFoundException } from '@nestjs/common';

// no database needed: replace the services that talk to Prisma
jest.mock('../prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../campaign/campaign.service', () => ({ CampaignService: class {} }));
jest.mock('../calculations/calculations.service', () => ({
  CalculationsService: class {},
}));
jest.mock('./group.service', () => ({ GroupService: class {} }));

import { GroupController } from './group.controller';

describe('GroupController.createGradingsAndComment', () => {
  // peer 1 owns the link "secret-link" in group 10 (peers 1 and 2)
  const connection = {
    groupId: 10,
    peerId: 1,
    peer: { peerId: 1, email: 'peer1@example.com' },
    group: {
      peers: [
        { peerId: 1, peer: { peerId: 1, userId: 101 } },
        { peerId: 2, peer: { peerId: 2, userId: 102 } },
      ],
      campaign: {
        campaignId: 3,
        maxPoints: 8,
        criteria: [{ criteriaId: 7 }],
        users: [{ userId: 900 }],
      },
    },
  };

  const setup = (found = true) => {
    const prisma: any = {
      groupPeerConnection: {
        findUnique: jest.fn().mockResolvedValue(found ? connection : null),
      },
    };
    const groupService: any = {
      upsertGradingsAndComment: jest.fn().mockResolvedValue(true),
    };
    const calculations: any = { getCampaignStatus: () => 'gestartet' };
    const campaignService: any = { getCampaignById: jest.fn() };
    const controller = new GroupController(
      groupService,
      prisma,
      calculations,
      campaignService,
    );
    return { controller, groupService };
  };

  // complete objects, like the frontend sends them
  const peer = (peerId: number) => ({
    peerId,
    firstName: 'First',
    lastName: 'Last',
    email: `peer${peerId}@example.com`,
  });
  const grading = (toPeerId: number, fromPeerId = 1) => ({
    points: 5,
    criteria: { criteriaId: 7, name: 'Quality', weight: 1 },
    toPeer: peer(toPeerId),
    fromPeer: peer(fromPeerId),
  });

  it('unknown link -> 404', async () => {
    const { controller } = setup(false);
    await expect(
      controller.createGradingsAndComment('nope', {
        groupId: 10,
        gradings: [grading(2)],
        comments: {},
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('sender and group always come from the link, not from the body', async () => {
    const { controller, groupService } = setup();
    // attacker pretends to be peer 2 in group 99
    await controller.createGradingsAndComment('secret-link', {
      groupId: 99,
      gradings: [grading(2, 2)],
      comments: {},
    });

    const saved = groupService.upsertGradingsAndComment.mock.calls[0][0];
    expect(saved.groupId).toBe(10);
    expect(saved.gradings[0].fromPeer.peerId).toBe(1);
  });

  it('rejects gradings for peers of another group', async () => {
    const { controller } = setup();
    await expect(
      controller.createGradingsAndComment('secret-link', {
        groupId: 10,
        gradings: [grading(55)],
        comments: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects comments to users outside the campaign/group', async () => {
    const { controller } = setup();
    await expect(
      controller.createGradingsAndComment('secret-link', {
        groupId: 10,
        gradings: [grading(2)],
        comments: { '12345': 'hello' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts comments to lecturers and group members', async () => {
    const { controller, groupService } = setup();
    await controller.createGradingsAndComment('secret-link', {
      groupId: 10,
      gradings: [grading(2)],
      comments: { '900': 'to lecturer', '102': 'to peer 2' },
    });
    expect(groupService.upsertGradingsAndComment).toHaveBeenCalled();
  });
});
