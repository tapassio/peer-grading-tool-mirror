import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SendgridService } from '../sendgrid/sendgrid.service';
import { PrismaService } from '../prisma.service';
import {
  CalculationsService,
  gradeRoundingOf,
} from '../calculations/calculations.service';

/**
 * Only these user fields may be sent to peers (public, no login).
 * Never include password, refreshToken or registerToken here.
 */
const publicUserSelect = {
  userId: true,
  firstName: true,
  lastName: true,
  email: true,
};

/**
 * the group service is used for actions done by peers in the frontend
 */
@Injectable()
export class GroupService {
  private readonly logger: Logger = new Logger(GroupService.name);

  constructor(
    private prisma: PrismaService,
    private sendGridService: SendgridService,
    private calculationsService: CalculationsService,
  ) {}

  /**
   * takes the data from the grading component in the frontend and saves it
   * @param data
   * @returns
   */
  async upsertGradingsAndComment(data: {
    gradings: any[];
    comments: any;
    groupId: number;
  }): Promise<any> {
    const gradings: any[] = data.gradings;
    const comments = data.comments;
    const groupId = data.groupId;
    const fromPeer = gradings[0].fromPeer;

    let logMessage = `gradings got by ${fromPeer.email} in group with id ${groupId}`;
    if (Object.keys(comments).length > 0) logMessage += ` with comments.`;
    else logMessage += ` without comments.`;
    this.logger.log(logMessage);

    // upserting gradings one by one
    const gradingResult = [];
    for (const grading of gradings) {
      const res = await this.prisma.grading.upsert({
        where: {
          GradingId: {
            fromPeerId: fromPeer.peerId,
            toPeerId: grading.toPeer.peerId,
            groupId: groupId,
            criteriaId: grading.criteria.criteriaId,
          },
        },
        update: {
          points: grading.points,
        },
        create: {
          points: grading.points,
          criteria: {
            connect: {
              criteriaId: grading.criteria.criteriaId,
            },
          },
          group: {
            connect: {
              groupId: groupId,
            },
          },
          fromPeer: {
            connect: {
              peerId: fromPeer.peerId,
            },
          },
          toPeer: {
            connect: {
              peerId: grading.toPeer.peerId,
            },
          },
        },
      });
      gradingResult.push(res);
    }

    // upserting comments
    for (const userIdKey in comments) {
      await this.prisma.comment.upsert({
        where: {
          groupId_fromPeerId_toUserId: {
            groupId: groupId,
            fromPeerId: fromPeer.peerId,
            toUserId: parseInt(userIdKey),
          },
        },
        update: {
          text: comments[userIdKey],
        },
        create: {
          text: comments[userIdKey],
          fromPeer: {
            connect: {
              peerId: fromPeer.peerId,
            },
          },
          group: {
            connect: {
              groupId: groupId,
            },
          },
          toUser: {
            connect: {
              userId: parseInt(userIdKey),
            },
          },
        },
      });
    }

    // sending confirmation mail to peer
    const peer = await this.prisma.peer.findUnique({
      where: {
        peerId: fromPeer.peerId,
      },
    });

    const gradingData = await this.prisma.group.findUnique({
      where: {
        groupId: groupId,
      },
      include: {
        peers: {
          include: {
            peer: true,
          },
        },
        gradings: {
          where: {
            fromPeer: {
              peerId: fromPeer.peerId,
            },
          },
          include: {
            fromPeer: true,
            toPeer: true,
            criteria: true,
          },
        },
        campaign: {
          include: {
            criteria: true,
          },
        },
        comments: {
          where: {
            fromPeerId: fromPeer.peerId,
          },
          include: {
            toUser: true,
          },
        },
      },
    });
    // The gradings are saved at this point. The confirmation mail is only a
    // receipt: if it cannot be sent (e.g. SendGrid not reachable), the
    // submission must not look failed to the student.
    try {
      await this.sendGridService.peerGradingConfirmation(gradingData, peer);
    } catch (error) {
      this.logger.warn(
        `gradings saved, but the confirmation mail could not be sent: ${error?.message ?? error}`,
      );
    }

    return true;
  }

  /**
   * this is a helper function to prepare data for both peer components in the frontend
   * @param url
   * @returns
   */
  private async getGroupByUrl(url: string): Promise<any> {
    const query = await this.prisma.groupPeerConnection.findUnique({
      where: { link: url },
      include: {
        peer: true,
        group: {
          include: {
            campaign: {
              include: {
                criteria: true,
                users: { select: publicUserSelect },
              },
            },
            peers: {
              include: {
                peer: true,
              },
            },
            comments: {
              include: {
                fromPeer: true,
                toUser: { select: publicUserSelect },
              },
            },
            gradings: {
              include: {
                fromPeer: true,
                toPeer: true,
                criteria: true,
              },
            },
          },
        },
      },
    });

    if (!query) {
      throw new NotFoundException();
    }

    const peer = query.peer;

    // formatting group data
    const { peers, comments, gradings, campaignId, campaign, ...rest } =
      query.group;
    const formatPeers = peers.map((peer) => peer.peer);

    const formatGradings = [];
    for (const grading of gradings) {
      const { toPeerId, fromPeerId, criteriaId, ...rest } = grading;
      formatGradings.push({
        ...rest,
      });
    }

    const group = {
      peers: formatPeers,
      gradings: formatGradings,
      ...rest,
    };

    const result = {
      peer,
      group,
      campaign,
      comments,
    };

    return result;
  }

  /**
   * this function prepares the data for the grading component
   * @param url
   * @returns
   */
  async getGradingDataByUrl(url: string) {
    const data = await this.getGroupByUrl(url);

    // this filters the gradings to only contain the gradings of the peer that made the request
    data.group.gradings = data.group.gradings.filter(
      (grading) => grading.fromPeer.peerId == data.peer.peerId,
    );

    // filters the comments to only contain the comments of the peer that made the request
    data.comments = data.comments.filter(
      (comment) => comment.fromPeer.peerId === data.peer.peerId,
    );

    return data;
  }

  /**
   * this function prepares the data for the grading review component
   * @param url
   * @returns
   */
  async getGradingReviewDataByUrl(url: string) {
    const data = await this.getGroupByUrl(url);

    const peer = data.peer;
    let group = data.group;
    const campaign = data.campaign;

    // getting comments in the group
    const commentsToPeer = await this.prisma.comment.findMany({
      where: {
        toUser: {
          userId: peer.userId,
        },
        group: {
          groupId: group.groupId,
        },
      },
      include: {
        fromPeer: true,
      },
    });

    // calculating numbers before sending to the frontend to make sure they are anonymous
    const thirdPartyAverages = {};
    const selfGradings = {};
    for (const crit of campaign.criteria) {
      thirdPartyAverages[crit.criteriaId] =
        this.calculationsService.getPeersThirdPartyAverageByCriteria(
          crit,
          group,
          peer,
        );
      selfGradings[crit.criteriaId] =
        this.calculationsService.getPeersSelfGradingPointsByCriteria(
          crit,
          group,
          peer,
        );
    }

    const result = {
      campaign: campaign,
      peer: peer,
      thirdPartyAverages: thirdPartyAverages,
      selfGradings: selfGradings,
      // unrounded average (for comparisons) and the final grade
      thirdPartyAverage: this.calculationsService.getPeersThirdPartyAverage(
        group,
        peer,
      ),
      grade: this.calculationsService.getPeersGrade(campaign, group, peer),
      gradeRounding: gradeRoundingOf(campaign),
      selfAverage: this.calculationsService.getPeersSelfAverage(group, peer),
      groupAverage: this.calculationsService.getGroupAverage(group),
      difference: this.calculationsService.getPeerReviewDifference(
        group,
        peer,
        gradeRoundingOf(campaign),
      ),
      comments: commentsToPeer,
    };

    // removes gradings and comments from group
    const { gradings, comments, ...rest } = group;
    group = rest;
    result['group'] = group;

    return result;
  }
}
