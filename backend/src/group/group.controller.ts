import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Group } from '@prisma/client';
import { JoiValidationPipe } from '../validators/joi-validation.pipe';
import { GroupService } from './group.service';
import { createGradingsAndCommentSchema } from '../validators/joi-objects';
import { PrismaService } from '../prisma.service';
import { CalculationsService } from '../calculations/calculations.service';
import { CampaignService } from '../campaign/campaign.service';

@Controller('group')
export class GroupController {
  constructor(
    private groupService: GroupService,
    private prisma: PrismaService,
    private calculationsService: CalculationsService,
    private campaignService: CampaignService,
  ) {}

  @Get(':url')
  async getGroupByPeer(@Param('url') url): Promise<Group> {
    return this.groupService.getGradingDataByUrl(String(url));
  }

  @Get('review/:url')
  async getGroupForReview(@Param('url') url): Promise<any> {
    return this.groupService.getGradingReviewDataByUrl(String(url));
  }

  /**
   * The personal link in the URL identifies the peer and the group.
   * groupId and fromPeer are taken from the database, never from the body.
   */
  @Post(':url')
  async createGradingsAndComment(
    @Param('url') url,
    @Body() data,
  ): Promise<any> {
    const connection = await this.prisma.groupPeerConnection.findUnique({
      where: { link: String(url) },
      include: {
        peer: true,
        group: {
          include: {
            peers: { include: { peer: true } },
            campaign: {
              include: {
                criteria: true,
                users: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    if (!connection) {
      throw new NotFoundException();
    }

    const campaign = connection.group.campaign;

    // validate the shape of the data first
    const dataValidation = new JoiValidationPipe(
      createGradingsAndCommentSchema(campaign.maxPoints),
    );
    dataValidation.transform(data, null);

    if (data.gradings.length === 0) {
      throw new BadRequestException('no gradings');
    }

    const campaignToCheck = await this.campaignService.getCampaignById(
      campaign.campaignId,
    );

    if (
      this.calculationsService.getCampaignStatus(campaignToCheck) ==
      'abgeschlossen'
    ) {
      throw new ForbiddenException('campaign is already closed');
    }

    // allowed targets: only peers of this group and criteria of this campaign
    const groupPeerIds = connection.group.peers.map((p) => p.peerId);
    const criteriaIds = campaign.criteria.map((c) => c.criteriaId);
    // comments may go to the campaign's lecturers or to peers of this group
    const allowedUserIds = [
      ...campaign.users.map((u) => u.userId),
      ...connection.group.peers.map((p) => p.peer.userId),
    ];

    for (const grading of data.gradings) {
      if (
        !groupPeerIds.includes(grading.toPeer?.peerId) ||
        !criteriaIds.includes(grading.criteria?.criteriaId)
      ) {
        throw new BadRequestException('invalid grading target');
      }
      // the sender is always the owner of the link
      grading.fromPeer = connection.peer;
    }

    for (const userIdKey in data.comments || {}) {
      if (!allowedUserIds.includes(parseInt(userIdKey))) {
        throw new BadRequestException('invalid comment target');
      }
    }

    data.groupId = connection.groupId;

    return this.groupService.upsertGradingsAndComment(data);
  }
}
