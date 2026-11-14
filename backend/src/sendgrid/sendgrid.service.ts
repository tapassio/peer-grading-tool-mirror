import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Peer } from '@prisma/client';
// default import: the package exports a class instance (methods on the
// prototype), which 'import * as' would lose with esModuleInterop (TS 6)
import SendGrid from '@sendgrid/mail';
import { I18nService } from 'nestjs-i18n';
import { env } from 'process';
import { UpdateCampaignCheckData } from '../campaign/campaign.service';
import { SanitizeService } from '../sanitize/sanitize.service';
/**
 * sendgrid service handles sending emails using sendgrid.
 */
@Injectable()
export class SendgridService {
  private readonly logger = new Logger(SendgridService.name);

  constructor(
    private readonly configService: ConfigService,
    private i18n: I18nService,
    private sanService: SanitizeService,
  ) {
    SendGrid.setApiKey(this.configService.get<string>('SEND_GRID_KEY'));
  }

  async adminOpening(campaign: any, lang: string): Promise<number> {
    const subject = `Peer Grading Tool - ${this.i18n.t(
      'mail.subject.campaignOpened',
      { lang: campaign.language },
    )}`;
    const url = `${env.HOST}/${lang}/campaign-summary/${campaign.campaignId}`;

    let adminMailsSent = 0;

    for (const user of campaign.users) {
      const html = `<p>${this.i18n.t('mail.greet', {
        lang: lang,
        args: {
          firstName: this.sanService.sanitize(user.firstName),
          lastName: this.sanService.sanitize(user.lastName),
        },
      })}</p>
        <p><b>${this.i18n.t('mail.campaignOpenedText', {
          lang: lang,
          args: {
            campaignName: this.sanService.sanitize(campaign.name),
          },
        })}</b></p>
        <p>${this.i18n.t('mail.peersInformed', {
          lang: lang,
        })}</p>
        <p><a href="${url}">${this.i18n.t('mail.toCampaignOverview', {
          lang: lang,
        })}</a></p>
        <p>${this.i18n.t('mail.kindRegards', {
          lang: lang,
        })}<br />${this.i18n.t('mail.pgtTeam', {
          lang: lang,
        })}</p>`;

      const mail = {
        to: user.email,
        subject: subject,
        from: env.SEND_GRID_SENDER_EMAIL,
        html: html,
      };
      this.logger.log('sending admin opening mail to ' + mail.to);

      await SendGrid.send(mail);
      adminMailsSent++;
    }

    return adminMailsSent;
  }

  async peerOpening(campaign: any): Promise<number> {
    let peerMailsSent = 0;

    for (const group of campaign.groups) {
      for (const peer of group.peers) {
        const url = `${env.HOST}/${campaign.language}/peer-grading/${peer.link}`;
        const subject = `Peer Grading Tool - ${this.i18n.t(
          'mail.subject.callForGrading',
          { lang: campaign.language },
        )}`;
        const html = `<p>
            ${this.i18n.t('mail.greet', {
              lang: campaign.language,
              args: {
                firstName: this.sanService.sanitize(peer.firstName),
                lastName: this.sanService.sanitize(peer.lastName),
              },
            })}
          </p>
          <p>
          ${this.i18n.t('mail.callForGradingText', {
            lang: campaign.language,
            args: {
              adminFirstName: this.sanService.sanitize(
                campaign.users[0].firstName,
              ),
              adminLastName: this.sanService.sanitize(
                campaign.users[0].lastName,
              ),
              campaignName: this.sanService.sanitize(campaign.name),
            },
          })}
          </p>
          <p><a href="${url}">${this.i18n.t('mail.gradingLink', {
            lang: campaign.language,
          })}</a></p>
          <p>${this.i18n.t('mail.kindRegards', {
            lang: campaign.language,
          })}<br />
          ${this.i18n.t('mail.pgtTeam', { lang: campaign.language })}</p>`;

        const mail = {
          to: peer.email,
          subject: subject,
          from: env.SEND_GRID_SENDER_EMAIL,
          html: html,
        };

        this.logger.log('sending peer opening mail to ' + mail.to);

        await SendGrid.send(mail);
        peerMailsSent++;
      }
    }
    return peerMailsSent;
  }

  async adminClosing(campaign: any, lang: string): Promise<number> {
    const pdfUrl = `${env.HOST}/${lang}/pdf/summary/${campaign.campaignId}`;
    const xlsxUrl = `${env.HOST}/${lang}/excel/${campaign.campaignId}`;

    const pdfLink = `<a href="${pdfUrl}">${this.i18n.t('mail.pdfLinkText', {
      lang: lang,
    })}</a>`;
    const xlsxLink = `<a href="${xlsxUrl}">${this.i18n.t('mail.xlsxLinkText', {
      lang: lang,
    })}</a>`;

    const subject = `Peer Grading Tool - ${this.i18n.t(
      'mail.subject.campaignEnded',
      {
        lang: lang,
      },
    )}`;

    let adminMailsSent = 0;

    for (const user of campaign.users) {
      const html = `<p>${this.i18n.t('mail.greet', {
        lang: lang,
        args: {
          firstName: this.sanService.sanitize(user.firstName),
          lastName: this.sanService.sanitize(user.lastName),
        },
      })}</p>
        <p><b>${this.i18n.t('mail.campaignEnded', {
          lang: lang,
          args: {
            campaignName: this.sanService.sanitize(campaign.name),
          },
        })}</b></p>
        <p>${this.i18n.t('mail.campaignOverviewLinks', {
          lang: lang,
          args: {
            pdfLink,
            xlsxLink,
          },
        })}</p>
        <p>${this.i18n.t('mail.kindRegards', {
          lang: lang,
        })}<br />${this.i18n.t('mail.pgtTeam', {
          lang: lang,
        })}</p>`;

      const mail = {
        to: user.email,
        subject: subject,
        from: env.SEND_GRID_SENDER_EMAIL,
        html: html,
      };

      this.logger.log('sending admin closing mail to ' + mail.to);

      await SendGrid.send(mail);
      adminMailsSent++;
    }

    return adminMailsSent;
  }

  async peerClosing(campaign: any): Promise<number> {
    let peerMailsSent = 0;

    for (const group of campaign.groups) {
      for (const peer of group.peers) {
        const pdfUrl = `${env.HOST}/${campaign.language}/pdf/review/${peer.link}`;
        const reviewURL = `${env.HOST}/${campaign.language}/peer-grading-review/${peer.link}`;

        const subject = `Peer Grading Tool - ${this.i18n.t(
          'mail.subject.reviewReady',
          { lang: campaign.language },
        )}`;
        const html = `<p>
          ${this.i18n.t('mail.greet', {
            lang: campaign.language,
            args: {
              firstName: this.sanService.sanitize(peer.firstName),
              lastName: this.sanService.sanitize(peer.lastName),
            },
          })}
        </p>
        <p>
          ${this.i18n.t('mail.gradingReviewText', {
            lang: campaign.language,
            args: {
              groupNumber: group.number,
              campaignName: this.sanService.sanitize(campaign.name),
            },
          })}
        </p>
        <p><a href="${reviewURL}">${this.i18n.t('mail.reviewLink', {
          lang: campaign.language,
        })}</a> ${this.i18n.t('mail.or', {
          lang: campaign.language,
        })} <a href="${pdfUrl}">${this.i18n.t('mail.downloadPDF', {
          lang: campaign.language,
        })}</a></p>
        <p>${this.i18n.t('mail.kindRegards', {
          lang: campaign.language,
        })}<br />
        ${this.i18n.t('mail.pgtTeam', { lang: campaign.language })}</p>`;

        const mail = {
          to: peer.email,
          subject: subject,
          from: env.SEND_GRID_SENDER_EMAIL,
          html: html,
        };

        this.logger.log('sending peer closing mail to ' + mail.to);

        await SendGrid.send(mail);
        peerMailsSent++;
      }
    }
    return peerMailsSent;
  }

  async remindAdmin(campaign: any, lang: string): Promise<number> {
    const peersToRemind = this.getPeersToRemind(campaign);

    let adminMailsSent = 0;

    const subject = `Peer Grading Tool - ${this.i18n.t(
      'mail.subject.reminder',
      {
        lang: lang,
      },
    )}`;
    for (const user of campaign.users) {
      let html = `<p>${this.i18n.t('mail.greet', {
        lang: lang,
        args: {
          firstName: this.sanService.sanitize(user.firstName),
          lastName: this.sanService.sanitize(user.lastName),
        },
      })}</p>`;

      const url = `${env.HOST}/${lang}/campaign-summary/${campaign.campaignId}`;

      if (peersToRemind.length > 0) {
        html += `
        <p>${this.i18n.t('mail.campaignReminderText', {
          lang: lang,
          args: {
            campaignName: this.sanService.sanitize(campaign.name),
          },
        })}</p>
        <ul>`;

        for (const peer of peersToRemind) {
          html += `<li>${peer.lastName} ${peer.firstName}</li>`;
        }

        html += `</ul>`;
      } else {
        html += `<p>${this.i18n.t('mail.campaignNoReminderText', {
          lang: lang,
          args: {
            campaignName: this.sanService.sanitize(campaign.name),
          },
        })}</p>`;
      }

      html += `<p><a href="${url}">${this.i18n.t('mail.toCampaignOverview', {
        lang: lang,
      })}</a></p>
        <p>${this.i18n.t('mail.kindRegards', {
          lang: lang,
        })}<br />${this.i18n.t('mail.pgtTeam', {
          lang: lang,
        })}</p>`;

      const mail = {
        to: user.email,
        subject: subject,
        from: env.SEND_GRID_SENDER_EMAIL,
        html: html,
      };
      this.logger.log('sending admin reminder mail to ' + mail.to);

      await SendGrid.send(mail);
      adminMailsSent++;
    }
    return adminMailsSent;
  }

  async peerRenewGrading(campaign: any): Promise<number> {
    let peerMailsSent = 0;

    for (const group of campaign.groups) {
      for (const peer of group.peers) {
        const url = `${env.HOST}/${campaign.language}/peer-grading/${peer.link}`;
        const subject = `Peer Grading Tool - ${this.i18n.t(
          'mail.subject.renewCallForGrading',
          { lang: campaign.language },
        )}`;
        const html = `<p>
            ${this.i18n.t('mail.greet', {
              lang: campaign.language,
              args: {
                firstName: this.sanService.sanitize(peer.firstName),
                lastName: this.sanService.sanitize(peer.lastName),
              },
            })}
          </p>
          <p>
          ${this.i18n.t('mail.renewCallForGradingText', {
            lang: campaign.language,
            args: {
              campaignName: this.sanService.sanitize(campaign.name),
            },
          })}
          </p>
          <p><a href="${url}">${this.i18n.t('mail.gradingLink', {
            lang: campaign.language,
          })}</a></p>
          <p>${this.i18n.t('mail.kindRegards', {
            lang: campaign.language,
          })}<br />
          ${this.i18n.t('mail.pgtTeam', { lang: campaign.language })}</p>`;

        const mail = {
          to: peer.email,
          subject: subject,
          from: env.SEND_GRID_SENDER_EMAIL,
          html: html,
        };

        this.logger.log('sending peer renew grading mail to ' + mail.to);

        await SendGrid.send(mail);
        peerMailsSent++;
      }
    }
    return peerMailsSent;
  }

  async remindPeers(campaign: any): Promise<number> {
    const peersToRemind = this.getPeersToRemind(campaign);

    let peerMailsSent = 0;

    for (const peer of peersToRemind) {
      const url = `${env.HOST}/${campaign.language}/peer-grading/${peer.link}`;
      const subject = `Peer Grading Tool - ${this.i18n.t(
        'mail.subject.gradingReminder',
        {
          lang: campaign.language,
        },
      )}`;

      const html = `<p>
          ${this.i18n.t('mail.greet', {
            lang: campaign.language,
            args: {
              firstName: this.sanService.sanitize(peer.firstName),
              lastName: this.sanService.sanitize(peer.lastName),
            },
          })}
        </p>
        <p>
          ${this.i18n.t('mail.gradingReminderText', {
            lang: campaign.language,
            args: {
              adminFirstName: this.sanService.sanitize(
                campaign.users[0].firstName,
              ),
              adminLastName: this.sanService.sanitize(
                campaign.users[0].lastName,
              ),
              campaignName: this.sanService.sanitize(campaign.name),
            },
          })}
        </p>
        <p><a href="${url}">
          ${this.i18n.t('mail.gradingLink', {
            lang: campaign.language,
          })}
        </a></p>
        <p>${this.i18n.t('mail.kindRegards', {
          lang: campaign.language,
        })}<br />
        ${this.i18n.t('mail.pgtTeam', { lang: campaign.language })}</p>`;

      const mail = {
        to: peer.email,
        subject: subject,
        from: env.SEND_GRID_SENDER_EMAIL,
        html: html,
      };

      this.logger.log('sending peer reminder mail to ' + mail.to);

      await SendGrid.send(mail);
      peerMailsSent++;
    }

    return peerMailsSent;
  }

  private getPeersToRemind(campaign: any): any[] {
    const result = [];

    for (const group of campaign.groups) {
      if (!group.gradings) {
        result.push(...group.peers);
      } else {
        for (const peer of group.peers) {
          if (group.gradings) {
            const gradingsByPeer = group.gradings.filter(
              (grading) => grading.fromPeer.peerId === peer.peerId,
            );

            if (
              gradingsByPeer.length <
              group.peers.length * campaign.criteria.length
            ) {
              result.push(peer);
            }
          }
        }
      }
    }

    return result;
  }

  async adminCampaignChanged(
    campaign: any,
    checkData: UpdateCampaignCheckData,
    lang: string,
  ): Promise<number> {
    const subject = `Peer Grading Tool - ${this.i18n.t(
      'mail.subject.campaignChanged',
      {
        lang: lang,
      },
    )}`;
    const url = `${env.HOST}/${lang}/campaign-summary/${campaign.campaignId}`;

    let adminMailsSent = 0;

    for (const user of campaign.users) {
      let html = `<p>${this.i18n.t('mail.greet', {
        lang: lang,
        args: {
          firstName: this.sanService.sanitize(user.firstName),
          lastName: this.sanService.sanitize(user.lastName),
        },
      })}</p>
        <p><b>${this.i18n.t('mail.campaignChangedText', {
          lang: lang,
          args: {
            campaignName: this.sanService.sanitize(campaign.name),
          },
        })}</b></p>`;

      html += '<p>';

      if (checkData.oldCampaignName) {
        html += `${this.i18n.t('mail.campaignChangedRename', {
          lang: lang,
          args: {
            oldCampaignName: this.sanService.sanitize(
              checkData.oldCampaignName,
            ),
            campaignName: this.sanService.sanitize(campaign.name),
          },
        })}<br />`;
      }

      if (checkData.allowCommentsForPeersChanged != undefined) {
        if (campaign.allowCommentsForPeers) {
          html += `${this.i18n.t('mail.campaignChangedAllowCommentsEnabled', {
            lang: lang,
            args: {
              oldAllowCommentsForPeers: checkData.allowCommentsForPeersChanged,
              allowCommentsForPeers: campaign.allowCommentsForPeers,
            },
          })}<br />`;
        } else {
          html += `${this.i18n.t('mail.campaignChangedAllowCommentsDisabled', {
            lang: lang,
            args: {
              oldAllowCommentsForPeers: checkData.allowCommentsForPeersChanged,
              allowCommentsForPeers: campaign.allowCommentsForPeers,
            },
          })}<br />`;
        }
      }

      if (checkData.addedGroups.length > 0) {
        html += `${this.i18n.t('mail.campaignChangedGroupsAdded', {
          lang: lang,
          args: {
            numberOfGroups: checkData.addedGroups.length,
          },
        })}<br />`;
      }

      if (checkData.removedGroups.length > 0) {
        html += `${this.i18n.t('mail.campaignChangedGroupsRemoved', {
          lang: lang,
          args: {
            numberOfGroups: checkData.removedGroups.length,
          },
        })}<br />`;
      }

      if (checkData.changedGroups.length > 0) {
        html += `${this.i18n.t('mail.campaignChangedGroupsChanged', {
          lang: lang,
          args: {
            numberOfGroups: checkData.changedGroups.length,
          },
        })}<br />`;
      }

      html += '</p>';

      html += `<p>${this.i18n.t('mail.peersMessaged', {
        lang: lang,
      })}</p>`;

      html += `<p><a href="${url}">${this.i18n.t('mail.toCampaignOverview', {
        lang: lang,
      })}</a></p>
        <p>${this.i18n.t('mail.kindRegards', {
          lang: lang,
        })}<br />${this.i18n.t('mail.pgtTeam', {
          lang: lang,
        })}</p>`;

      const mail = {
        to: user.email,
        subject: subject,
        from: env.SEND_GRID_SENDER_EMAIL,
        html: html,
      };
      this.logger.log('sending admin campaign changed mail to ' + mail.to);

      await SendGrid.send(mail);
      adminMailsSent++;
    }

    return adminMailsSent;
  }

  async peerGradingConfirmation(data: any, peer: Peer) {
    const subject = `Peer Grading Tool - ${this.i18n.t(
      'mail.subject.gradingRecieved',
      {
        lang: data.campaign.language,
      },
    )}`;
    let html = `<p>
      ${this.i18n.t('mail.greet', {
        lang: data.campaign.language,
        args: {
          firstName: this.sanService.sanitize(peer.firstName),
          lastName: this.sanService.sanitize(peer.lastName),
        },
      })}
    </p>
      <p>${this.i18n.t('mail.gradingRecievedText', {
        lang: data.campaign.language,
        args: { campaignName: this.sanService.sanitize(data.campaign.name) },
      })}</p>`;

    html += `<table><tr><th></th>`;

    for (const crit of data.campaign.criteria) {
      html += `<th>${crit.name}</th>`;
    }

    html += `</tr>`;

    for (const peer of data.peers.map((peer) => peer.peer)) {
      html += `<tr><td>${this.sanService.sanitize(
        peer.lastName,
      )} ${this.sanService.sanitize(peer.firstName)}</td>`;
      for (const crit of data.campaign.criteria) {
        html += `<td>${
          data.gradings.filter(
            (grading) =>
              grading.toPeerId == peer.peerId &&
              crit.criteriaId == grading.criteria.criteriaId,
          )[0].points
        }</td>`;
      }
      html += `</tr>`;
    }

    html += `</table>`;

    if (data.comments.length != 0) {
      html += `<p><b>${this.i18n.t('mail.comments', {
        lang: data.campaign.language,
      })}</b></p>`;
      for (const comment of data.comments) {
        html += `<p>${this.i18n.t('mail.commentFor', {
          lang: data.campaign.language,
          args: {
            firstName: this.sanService.sanitize(comment.toUser.firstName),
            lastName: this.sanService.sanitize(comment.toUser.lastName),
          },
        })}: ${this.sanService.sanitize(comment.text)}</p>`;
      }
    }

    html += `<p>${this.i18n.t('mail.kindRegards', {
      lang: data.campaign.language,
    })}<br />
    ${this.i18n.t('mail.pgtTeam', { lang: data.campaign.language })}</p>`;

    const mail = {
      to: data.gradings[0].fromPeer.email,
      subject: subject,
      from: env.SEND_GRID_SENDER_EMAIL,
      html: html,
    };

    this.logger.log('sending peer grading confirmation mail to ' + mail.to);

    await SendGrid.send(mail);
  }

  async adminCreated(admin: any) {
    const subject = 'Peer Grading Tool - your access';
    const url = `${env.HOST}`;
    const html = `<p>Hello ${this.sanService.sanitize(
      admin.firstName,
    )} ${this.sanService.sanitize(admin.lastName)}</p>
      <p>You have been registered in the peer grading tool by an administrator with the following e-mail address: <b>${
        admin.email
      }</b></p>
      <p>We recommend that you reset your password first. To do this, go to "Profile" in the navigation bar after logging in.</p>
      <p><a href="${url}">To the Peer Grading Tool</a></p>
      <p>Kind regards,<br />The Peer Grading Tool Team</p>`;

    const mail = {
      to: admin.email,
      subject: subject,
      from: env.SEND_GRID_SENDER_EMAIL,
      html: html,
    };

    this.logger.log('sending admin created mail to ' + mail.to);

    await SendGrid.send(mail);
  }

  async adminConfirmationRequest(user: any, lang: string) {
    const subject = 'Peer Grading Tool - confirm e-mail adress';
    const url = `${env.HOST}/${lang}/register/${user.registerToken}`;
    const html = `<p>Hello ${this.sanService.sanitize(
      user.firstName,
    )} ${this.sanService.sanitize(user.lastName)}</p>
      <p>You have been registered in the peer grading tool with the following e-mail address: <b>${
        user.email
      }</b></p>
      <p>To complete the registration, please click on the following link. It is valid for one hour.</p>
      <p><a href="${url}">confirm e-mail</a></p>
      <p>If you have not triggered this message, you can ignore it.</p>
      <p>Kind regards,<br />The Peer Grading Tool Team</p>`;

    const mail = {
      to: user.email,
      subject: subject,
      from: env.SEND_GRID_SENDER_EMAIL,
      html: html,
    };

    this.logger.log('sending admin confirmation request mail to ' + mail.to);

    await SendGrid.send(mail);
  }
}
