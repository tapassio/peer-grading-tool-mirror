import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  Campaign,
  Criteria,
  Group,
  GroupPeerConnection,
  Prisma,
} from '@prisma/client';
import { AppService } from '../app.service';
import { SendgridService } from '../sendgrid/sendgrid.service';
import { CampaignStatus, Grading, MailsSent, User } from '../interfaces';
import { CalculationsService } from '../calculations/calculations.service';

export interface UpdateCampaignCheckData {
  campaignStatus: CampaignStatus;
  addedGroups: any[];
  removedGroups: any[];
  changedGroups: any[];
  oldCampaignName?: string;
  allowCommentsForPeersChanged?: boolean;
}

/**
 * this service handles campaign data
 */
@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private sendGridService: SendgridService,
    private prisma: PrismaService,
    private appService: AppService,
    private calculationsService: CalculationsService,
  ) {}

  async getCampaignById(
    campaignId: number,
    prisma?: Prisma.TransactionClient,
    withLinks: boolean = false,
  ): Promise<any | null> {
    const prismaService = prisma ? prisma : this.prisma;
    const query = await prismaService.campaign.findUnique({
      where: {
        campaignId: campaignId,
      },
      include: {
        criteria: { include: { gradings: true } },
        groups: {
          include: {
            peers: {
              include: {
                peer: {
                  include: {
                    user: {
                      select: {
                        userId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
            gradings: {
              include: {
                fromPeer: true,
                toPeer: true,
                criteria: true,
              },
            },
            comments: {
              include: {
                fromPeer: true,
                toUser: {
                  select: {
                    userId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        users: {
          select: {
            userId: true,
            lastName: true,
            firstName: true,
            email: true,
          },
        },
      },
    });
    if (query) {
      const formatGroups = [];

      for (const group of query.groups) {
        const { campaignId, peers, gradings, comments, ...rest } = group;

        const formatPeers = peers.map((groupPeerConnection) => {
          const res = groupPeerConnection.peer;
          if (withLinks) {
            res['link'] = groupPeerConnection.link;
          }
          return res;
        });

        const formatComments = comments.map((comment) => {
          const { fromPeer, fromPeerId, groupId, toUserId, ...commentRest } =
            comment;
          return {
            fromPeer,
            ...commentRest,
          };
        });

        const formatGradings = gradings.map((grading) => {
          const { groupId, ...rest } = grading;
          return rest;
        });

        formatGroups.push({
          peers: formatPeers,
          comments: formatComments,
          gradings: formatGradings,
          ...rest,
        });
      }

      const { groups, ...rest } = query;

      return {
        groups: formatGroups,
        ...rest,
      };
    } else return null;
  }

  /**
   * gets all the campaigns from a user as an array
   * @param email
   * @returns
   */
  async getCampaignsByUser(email: string): Promise<Campaign[] | null> {
    return this.prisma.campaign.findMany({
      include: {
        criteria: true,
        groups: {
          include: {
            peers: {
              include: {
                peer: true,
              },
            },
            gradings: true,
          },
        },
      },
      where: {
        users: {
          some: {
            email: email,
          },
        },
      },
    });
  }

  async createCampaign(campaignData: any, user: User): Promise<Campaign> {
    this.logger.log(
      `creating campaign "${campaignData.name}". User: ${user.email}`,
    );

    const campaign = await this.prisma.$transaction<Campaign>(
      async (tx) => {
        // initial creation
        const campaign = await tx.campaign.create({
          data: {
            name: campaignData.name,
            maxPoints: campaignData.maxPoints,
            language: campaignData.language,
            allowCommentsForPeers: campaignData.allowCommentsForPeers,
            gradeRounding: campaignData.gradeRounding,
            // connecting to the user
            users: {
              connect: {
                userId: user.userId,
                email: user.email,
              },
            },
            // creating criteria
            criteria: {
              create: this.createCriteria(campaignData.criteria),
            },
            // creating groups (incomplete so more has to be done)
            groups: {
              create: this.createGroups(campaignData.groups),
            },
          },
          include: {
            groups: true,
            criteria: true,
          },
        });

        // updating groups to connect to peers and generate links
        for (const group of campaign.groups) {
          const peers = campaignData.groups.find(
            (gr) => gr.number == group.number,
          ).peers;
          await this.finalizeGroup(group, peers, tx);
        }

        return campaign;
      },
      {
        maxWait: 50000,
        timeout: 50000,
      },
    );

    return campaign;
  }

  private createCriteria(criteria): Criteria[] {
    return criteria.map((crit) => {
      const { name, weight } = crit;
      return { name, weight };
    });
  }

  private createGroups(groups): Group[] {
    return groups.map((group) => {
      const { number, completed } = group;
      return { number, completed };
    });
  }

  /**
   * adds peers to the group, and saves the links in the groupPeerConnection
   * @param groupToAlter
   * @param peersToAdd
   * @param tx
   */
  private async finalizeGroup(
    groupToAlter: Group,
    peersToAdd: Prisma.PeerUncheckedCreateInput,
    tx: Prisma.TransactionClient,
  ) {
    await tx.group.update({
      where: {
        groupId: groupToAlter.groupId,
      },
      data: {
        peers: {
          create: await this.createPeerGroupConnections(
            peersToAdd,
            groupToAlter.groupId,
            tx,
          ),
        },
      },
    });
  }

  private async createPeerGroupConnections(
    peers,
    groupId: number,
    tx: Prisma.TransactionClient,
  ): Promise<GroupPeerConnection[]> {
    const result = [];

    for (const peer of peers) {
      let updatedPeer;

      const foundPeer = await tx.peer.findUnique({
        where: {
          email: peer.email,
        },
      });

      if (foundPeer) {
        updatedPeer = await tx.peer.update({
          where: {
            peerId: foundPeer.peerId,
          },
          data: {
            firstName: peer.firstName,
            lastName: peer.lastName,
            matriculationNumber: peer.matriculationNumber ?? null,
          },
        });
      } else {
        updatedPeer = await tx.peer.create({
          data: {
            firstName: peer.firstName,
            lastName: peer.lastName,
            matriculationNumber: peer.matriculationNumber ?? null,
            email: peer.email,
            user: {
              connectOrCreate: {
                where: {
                  email: peer.email,
                },
                create: {
                  firstName: peer.firstName,
                  lastName: peer.lastName,
                  email: peer.email,
                  // peers never log in, so they get no password
                  roles: {
                    connect: {
                      roleId: 2,
                    },
                  },
                },
              },
            },
          },
        });
      }

      result.push({
        peer: {
          connect: {
            peerId: updatedPeer.peerId,
          },
        },
        link: this.appService.generateLink(),
      });
    }

    return result;
  }

  async updateCampaign(
    campaignData: any,
    user: User,
    lang: string,
  ): Promise<Campaign> {
    this.logger.log(
      `updating campaign "${campaignData.name}". User: ${user.email}`,
    );

    const checkData: UpdateCampaignCheckData = await this.prisma.$transaction(
      async (tx) => {
        // saving current campaign data for comparisons
        const oldCampaign = await this.getCampaignById(
          campaignData.campaignId,
          tx,
        );

        // getting campaign status
        const campaignStatus =
          this.calculationsService.getCampaignStatus(oldCampaign);

        // setting up variables for later checks
        const nameChanged = oldCampaign.name != campaignData.name;
        const allowCommentsForPeersChanged =
          oldCampaign.allowCommentsForPeers !=
          campaignData.allowCommentsForPeers;

        if (campaignStatus == 'abgeschlossen') {
          throw new ForbiddenException('campaign is already closed');
        }

        if (campaignStatus != 'erstellt' && allowCommentsForPeersChanged) {
          throw new ForbiddenException(
            'Cannot change allowing comments for peers on opened campaigns',
          );
        }

        // handling nonrelational property changes
        await tx.campaign.update({
          where: {
            campaignId: campaignData.campaignId,
          },
          data: {
            name: campaignData.name,
            maxPoints: campaignData.maxPoints,
            language: campaignData.language,
            allowCommentsForPeers: campaignData.allowCommentsForPeers,
            gradeRounding: campaignData.gradeRounding,
          },
        });

        /////////////////// handling changes in criteria

        if (campaignStatus == 'erstellt') {
          await this.handleCriteria(oldCampaign, campaignData, tx);
        }

        ///////////////////// handling groups

        const groupData = await this.handleGroups(
          oldCampaign,
          campaignData,
          tx,
        );

        await this.deleteUnusedPeerUsers(tx);

        const checkData: UpdateCampaignCheckData = {
          campaignStatus,
          ...groupData,
        };

        if (nameChanged) checkData.oldCampaignName = oldCampaign.name;

        if (allowCommentsForPeersChanged)
          checkData.allowCommentsForPeersChanged = allowCommentsForPeersChanged;

        return checkData;
      },
      {
        maxWait: 50000,
        timeout: 50000,
      },
    );

    if (checkData.campaignStatus == 'läuft') {
      this.checkForMailsExistingCampaign(
        await this.getCampaignById(campaignData.campaignId, undefined, true),
        checkData,
        lang,
      );
    }

    return await this.getCampaignById(campaignData.campaignId);
  }

  private async handleCriteria(
    oldCampaign,
    campaignData,
    tx: Prisma.TransactionClient,
  ) {
    const addedCriteria = campaignData.criteria.filter(
      (crit) => crit.criteriaId == 0,
    );
    const removedCriteria = oldCampaign.criteria.filter(
      (crit) =>
        campaignData.criteria.find(
          (criteria) => crit.criteriaId == criteria.criteriaId,
        ) == null,
    );
    const stayedCriteria = oldCampaign.criteria.filter(
      (crit) =>
        campaignData.criteria.find(
          (criteria) => crit.criteriaId == criteria.criteriaId,
        ) != null,
    );

    // if there are added criteria, delete all gradings and comments
    if (addedCriteria.length > 0) {
      // creating new criteria
      for (const crit of addedCriteria) {
        await tx.criteria.create({
          data: {
            name: crit.name,
            weight: crit.weight,
            campaignId: campaignData.campaignId,
          },
        });
      }

      // deleting gradings and comments
      await tx.grading.deleteMany({
        where: {
          group: {
            campaignId: campaignData.campaignId,
          },
        },
      });
      await tx.comment.deleteMany({
        where: {
          group: {
            campaignId: campaignData.campaignId,
          },
        },
      });
    }

    // if there are removed criteria, delete affected gradings
    if (removedCriteria.length > 0) {
      // deleting removed criteria
      await tx.criteria.deleteMany({
        where: {
          criteriaId: {
            in: removedCriteria.map((crit) => crit.criteriaId),
          },
        },
      });

      // deleting affected gradings
      await tx.grading.deleteMany({
        where: {
          criteriaId: {
            in: removedCriteria.map((crit) => crit.criteriaId),
          },
        },
      });
    }

    // staying criteria get updated values
    // currently not used because of the way the frontend works
    for (const crit of stayedCriteria) {
      await tx.criteria.update({
        where: {
          criteriaId: crit.criteriaId,
        },
        data: {
          name: crit.name,
          weight: crit.weight,
        },
      });
    }

    // not used currently
    return {
      addedCriteria,
      removedCriteria,
      stayedCriteria,
    };
  }

  private async handleGroups(
    oldCampaign: any,
    campaignData: any,
    tx: Prisma.TransactionClient,
  ) {
    const addedGroups = campaignData.groups.filter(
      (group) => group.groupId == 0,
    );
    const removedGroups = oldCampaign.groups.filter(
      (group) =>
        campaignData.groups.find((gr) => gr.groupId == group.groupId) == null,
    );
    const stayedGroups = oldCampaign.groups.filter(
      (group) =>
        campaignData.groups.find((gr) => gr.groupId == group.groupId) != null,
    );
    const changedGroups = [];

    // adding in groups
    for (const group of addedGroups) {
      const newGroup = await tx.group.create({
        data: {
          campaignId: campaignData.campaignId,
          number: group.number,
          completed: false,
        },
      });

      const peersToAdd = campaignData.groups.find(
        (gr) => gr.number == group.number,
      ).peers;
      await this.finalizeGroup(newGroup, peersToAdd, tx);
    }

    // deleting removed groups
    if (removedGroups.length > 0) {
      await tx.group.deleteMany({
        where: {
          groupId: {
            in: removedGroups.map((gr) => gr.groupId),
          },
        },
      });
    }

    // staying groups get their number as well as their peers updated
    for (const group of stayedGroups) {
      const peerCheckData = await this.handleStayedGroup(
        group,
        campaignData,
        tx,
      );

      if (
        peerCheckData.addedPeers.length > 0 ||
        peerCheckData.changedPeers.length > 0 ||
        peerCheckData.removedPeers.length > 0
      ) {
        const changedGroup = campaignData.groups.find(
          (gr) => gr.groupId == group.groupId,
        );
        changedGroup['addedPeers'] = peerCheckData.addedPeers;
        changedGroup['changedPeers'] = peerCheckData.changedPeers;
        changedGroup['removedPeers'] = peerCheckData.removedPeers;
        changedGroup['remainingPeers'] = peerCheckData.remainingPeers;
        changedGroups.push(changedGroup);
      }
    }

    return {
      addedGroups,
      changedGroups,
      removedGroups,
    };
  }

  async handleStayedGroup(
    oldGroup,
    campaignData,
    tx: Prisma.TransactionClient,
  ) {
    // getting the corresponding group from the new data
    const newGroup = campaignData.groups.find(
      (gr) => gr.groupId == oldGroup.groupId,
    );

    // updating number
    await tx.group.update({
      where: {
        groupId: oldGroup.groupId,
      },
      data: {
        number: newGroup.number,
      },
    });

    // setting up peers
    const addedPeers = newGroup.peers.filter((peer) => peer.peerId == 0);
    const removedPeers = oldGroup.peers.filter(
      (peer) => newGroup.peers.find((p) => p.peerId == peer.peerId) == null,
    );

    // changed peers only count as changed if there email changes
    const changedPeers = newGroup.peers.filter(
      (peer) =>
        oldGroup.peers.find(
          (p) => p.peerId == peer.peerId && p.email != peer.email,
        ) != null,
    );
    const remainingPeers = newGroup.peers.filter(
      (peer) =>
        changedPeers.find((p) => p.peerId == peer.peerId) == null &&
        addedPeers.find((p) => p.peerId == peer.peerId) == null,
    );

    // if peers were added to the group, finalize it and
    // delete all gradings and comments in the group
    if (addedPeers.length > 0) {
      await this.finalizeGroup(oldGroup, addedPeers, tx);
    }

    // if there were removed peers, delete affected gradings and comments
    for (const peer of removedPeers) {
      await tx.groupPeerConnection.delete({
        where: {
          groupId_peerId: {
            groupId: oldGroup.groupId,
            peerId: peer.peerId,
          },
        },
      });
    }
    await tx.grading.deleteMany({
      where: {
        groupId: oldGroup.groupId,
        fromPeerId: {
          in: removedPeers.map((peer) => peer.peerId),
        },
      },
    });
    await tx.grading.deleteMany({
      where: {
        groupId: oldGroup.groupId,
        toPeerId: {
          in: removedPeers.map((peer) => peer.peerId),
        },
      },
    });

    // deleting comments from peer
    await tx.comment.deleteMany({
      where: {
        groupId: oldGroup.groupId,
        fromPeerId: {
          in: removedPeers.map((peer) => peer.peerId),
        },
      },
    });

    // deleting comments to peer
    await tx.comment.deleteMany({
      where: {
        groupId: oldGroup.groupId,
        toUser: {
          peer: {
            peerId: {
              in: removedPeers.map((peer) => peer.peerId),
            },
          },
        },
      },
    });

    // remaining and changed peers get updated
    for (let peer of [...remainingPeers, ...changedPeers]) {
      let updatedPeer;

      // find a peer with that email
      const foundPeer = await tx.peer.findUnique({
        where: {
          email: peer.email,
        },
      });

      // if the stayed peer got his email changed
      // to the email of a peer that already exists
      // then we update this existing peer and the group peer connection
      if (foundPeer) {
        updatedPeer = await tx.peer.update({
          where: {
            email: peer.email,
          },
          data: {
            firstName: peer.firstName,
            lastName: peer.lastName,
            matriculationNumber: peer.matriculationNumber ?? null,
          },
          include: {
            user: true,
          },
        });
      } else {
        // if the stayedPeer's email isn't already used
        updatedPeer = await tx.peer.create({
          data: {
            firstName: peer.firstName,
            lastName: peer.lastName,
            matriculationNumber: peer.matriculationNumber ?? null,
            email: peer.email,
            user: {
              connectOrCreate: {
                where: {
                  email: peer.email,
                },
                create: {
                  firstName: peer.firstName,
                  lastName: peer.lastName,
                  email: peer.email,
                  // peers never log in, so they get no password
                },
              },
            },
          },
          include: {
            user: true,
          },
        });
      }

      // since it could be a new peer,
      // upgrade groupPeerConnection and existing gradings and comments
      await tx.groupPeerConnection.update({
        where: {
          groupId_peerId: {
            groupId: oldGroup.groupId,
            peerId: peer.peerId,
          },
        },
        data: {
          peerId: updatedPeer.peerId,
          // keep the existing link if it is still the same peer,
          // otherwise the link already sent by e-mail would stop working
          ...(updatedPeer.peerId !== peer.peerId && {
            link: this.appService.generateLink(),
          }),
        },
      });
      await tx.grading.updateMany({
        where: {
          groupId: oldGroup.groupId,
          fromPeerId: peer.peerId,
        },
        data: {
          fromPeerId: updatedPeer.peerId,
        },
      });
      await tx.grading.updateMany({
        where: {
          groupId: oldGroup.groupId,
          toPeerId: peer.peerId,
        },
        data: {
          toPeerId: updatedPeer.peerId,
        },
      });

      // updating comments from peer
      await tx.comment.updateMany({
        where: {
          groupId: oldGroup.groupId,
          fromPeerId: peer.peerId,
        },
        data: {
          fromPeerId: updatedPeer.peerId,
        },
      });

      // console.log('old peer user', peer);
      // console.log('updated peer', updatedPeer);

      // updating comments to peer
      await tx.comment.updateMany({
        where: {
          groupId: oldGroup.groupId,
          toUserId: peer.user.userId,
        },
        data: {
          toUserId: updatedPeer.user.userId,
        },
      });

      // assigning the updatedPeer to the stayed Peer for the return value
      peer = { ...updatedPeer };
    }

    return {
      addedPeers,
      remainingPeers,
      removedPeers,
      changedPeers,
    };
  }

  private async checkForMailsExistingCampaign(
    campaign: any,
    checkData: UpdateCampaignCheckData,
    lang: string,
  ) {
    this.logger.log(
      `checking if mails have to be sent for campaign "${campaign.name}" (id: ${campaign.campaignId})`,
    );

    // handle added groups
    for (const addedGroup of checkData.addedGroups) {
      this.logger.log(`group #${addedGroup.number} was added`);
      const correspondingGroup = campaign.groups.find(
        (gr) => gr.number == addedGroup.number,
      );

      const { groups, ...rest } = campaign;

      if (correspondingGroup) {
        await this.sendGridService.peerOpening({
          groups: [correspondingGroup],
          ...rest,
        });
      }
    }

    // removed groups require no action at the moment
    for (const removedGroup of checkData.removedGroups) {
      this.logger.log(`group #${removedGroup.number} was removed`);
    }

    // handle changedGroups
    for (const changedGroup of checkData.changedGroups) {
      this.logger.log(`group #${changedGroup.number} was changed`);

      // preparing constants
      const { groups, ...campaignRest } = campaign;
      const { changedPeers, addedPeers, remainingPeers, peers, ...groupRest } =
        changedGroup;

      const correspondingGroup = campaign.groups.find(
        (gr) => gr.number == changedGroup.number,
      );

      const correspondingAddedAndChangedPeers = correspondingGroup.peers.filter(
        (peer) => {
          return (
            changedGroup.addedPeers.find((p) => peer.email == p.email) !=
              null ||
            changedGroup.changedPeers.find((p) => peer.email == p.email) != null
          );
        },
      );

      // calling changed and added peers for grading
      await this.sendGridService.peerOpening({
        groups: [
          {
            peers: [...correspondingAddedAndChangedPeers],
            ...groupRest,
          },
        ],
        ...campaignRest,
      });

      // if peers were added. the remaining peers get a renew grading message
      // but only if they got had already sent gradings
      if (changedGroup.addedPeers.length > 0) {
        const correspondingRemainingPeers = correspondingGroup.peers.filter(
          (peer) => {
            return (
              changedGroup.remainingPeers.find((p) => peer.email == p.email) &&
              correspondingGroup.gradings.filter(
                (grading: Grading) => grading.fromPeer.peerId === peer.peerId,
              ).length > 0
            );
          },
        );

        await this.sendGridService.peerRenewGrading({
          groups: [
            {
              peers: [...correspondingRemainingPeers],
              ...groupRest,
            },
          ],
          ...campaignRest,
        });
      }
    }

    // handle the change message for the admin
    if (
      checkData.changedGroups.length > 0 ||
      checkData.addedGroups.length > 0 ||
      checkData.oldCampaignName
    ) {
      if (checkData.oldCampaignName) {
        this.logger.log(
          `the campaign was renamed from ${checkData.oldCampaignName} to ${campaign.name}`,
        );
      }

      if (checkData.allowCommentsForPeersChanged != undefined) {
        this.logger.log(
          `the campaign's allow comments for peers was set to ${campaign.allowCommentsForPeers}`,
        );
      }

      if (checkData.addedGroups.length > 0) {
        this.logger.log(
          `${
            checkData.addedGroups.length
          } groups added. numbers: ${checkData.addedGroups.map(
            (gr) => gr.number,
          )}`,
        );
      }
      if (checkData.changedGroups.length > 0) {
        this.logger.log(
          `${
            checkData.changedGroups.length
          } groups changed. numbers: ${checkData.changedGroups.map(
            (gr) => gr.number,
          )}`,
        );
      }
      await this.sendGridService.adminCampaignChanged(
        campaign,
        checkData,
        lang,
      );
    }
  }

  /**
   * triggered by the frontend to set a campaign's openingDate and send all opening mails
   * @param campaignId
   * @returns the number of mails sent
   */
  async startCampaign(campaignId: number, lang: string): Promise<MailsSent> {
    const campaign = await this.getCampaignById(campaignId, undefined, true);

    this.logger.log(
      `starting campaign ${campaign.name} (id: ${campaign.campaignId}).`,
    );

    if (campaign.openingDate) {
      throw new HttpException('campaign has already started', 403);
    }

    await this.prisma.campaign.update({
      where: {
        campaignId: campaignId,
      },
      data: {
        openingDate: new Date(),
      },
    });

    let peerMailsSent = 0;
    let adminMailsSent = 0;

    peerMailsSent += await this.sendGridService.peerOpening(campaign);
    adminMailsSent += await this.sendGridService.adminOpening(campaign, lang);

    return {
      peerMailsSent,
      adminMailsSent,
    };
  }

  /**
   * triggered by the frontend to set a campaign's closingDate and disable further grading
   * @param campaignId
   */
  async endCampaign(campaignId: number): Promise<any> {
    const campaign = await this.getCampaignById(campaignId, undefined, true);

    this.logger.log(
      `ending campaign ${campaign.name} (id: ${campaign.campaignId}).`,
    );

    if (!campaign.openingDate) {
      throw new HttpException(`campaign hasn't started yet`, 403);
    }

    return await this.prisma.campaign.update({
      where: {
        campaignId: campaignId,
      },
      data: {
        closingDate: new Date(),
      },
    });
  }

  /**
   * triggered by the frontend to set a campaign's closingDate and disable further grading
   * @param campaignId
   * @returns the number of mails sent
   */
  async sendResultMails(campaignId: number, lang: string): Promise<MailsSent> {
    const campaign = await this.getCampaignById(campaignId, undefined, true);

    this.logger.log(
      `sending result mails for campaign ${campaign.name} (id: ${campaign.campaignId}).`,
    );

    if (!campaign.openingDate) {
      throw new HttpException(`campaign hasn't started yet`, 403);
    }

    let peerMailsSent = 0;
    let adminMailsSent = 0;

    peerMailsSent += await this.sendGridService.peerClosing(campaign);
    adminMailsSent += await this.sendGridService.adminClosing(campaign, lang);

    return {
      peerMailsSent,
      adminMailsSent,
    };
  }

  /**
   * this function can be triggered in the frontend
   * @param campaignId
   */
  async sendReminderMails(
    campaignId: number,
    lang: string,
  ): Promise<MailsSent> {
    const campaign = await this.getCampaignById(campaignId, undefined, true);

    this.logger.log(
      `reminding pending peers of campaign ${campaign.name} (id: ${campaign.campaignId}).`,
    );

    let peerMailsSent = 0;
    let adminMailsSent = 0;

    peerMailsSent += await this.sendGridService.remindPeers(campaign);
    adminMailsSent += await this.sendGridService.remindAdmin(campaign, lang);

    return {
      peerMailsSent,
      adminMailsSent,
    };
  }

  /**
   * deletes campaigns and their criteria and groups
   * @param where
   * @returns
   */
  async deleteCampaign(where: Prisma.CampaignWhereUniqueInput) {
    this.logger.log(`campaign with id ${where.campaignId} deleted`);

    return await this.prisma.$transaction(async (tx) => {
      await tx.criteria.deleteMany({
        where: { campaignId: where.campaignId },
      });
      await tx.group.deleteMany({
        where: { campaignId: where.campaignId },
      });
      await tx.campaign.delete({
        where,
      });

      await this.deleteUnusedPeerUsers(tx);
    });
  }

  /**
   * this function is run if a campaign is deleted or if a campaign is updated
   * it checks for peers that are no longer in any campaign and deletes them
   * @param prisma
   */
  private async deleteUnusedPeerUsers(prisma: Prisma.TransactionClient) {
    const peers = await prisma.peer.findMany({
      where: { groups: { none: {} } },
      include: { user: true },
    });

    if (peers) {
      await prisma.peer.deleteMany({
        where: { peerId: { in: peers.map((peer) => peer.peerId) } },
      });

      await prisma.role.update({
        where: { roleId: 2 },
        data: {
          users: {
            deleteMany: peers.map((peer) => ({ userId: peer.user.userId })),
          },
        },
      });
    }
  }
}
