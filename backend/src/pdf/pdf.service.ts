import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

import {
  Group,
  Peer,
  Campaign,
  PeerComment,
  Criteria,
  User,
} from '../interfaces';

import {
  CalculationsService,
  gradeRoundingOf,
} from '../calculations/calculations.service';
import { I18nService } from 'nestjs-i18n';
import { AppService } from '../app.service';
import { CampaignService } from '../campaign/campaign.service';
import { SanitizeService } from '../sanitize/sanitize.service';
import htmlToPdfMake from 'html-to-pdfmake';
import { JSDOM } from 'jsdom';
import * as path from 'path';
import PdfPrinter from 'pdfmake';
const { window } = new JSDOM('');

interface ReviewData {
  peer: Peer;
  group: Group;
  campaign: Partial<Campaign>;
}

/**
 * this service generates pdfs using html to pdf make.
 * one for the campaign summary, one for the peer review
 */
@Injectable()
export class PdfService {
  constructor(
    private prisma: PrismaService,
    private calculationsService: CalculationsService,
    private i18n: I18nService,
    private appService: AppService,
    private campaignService: CampaignService,
    private sanService: SanitizeService,
  ) {}

  async getCampaignPDF(
    campaignId: number,
    userEmail: { email: string },
    lang: string,
  ): Promise<any> {
    // getting data from db
    const campaign = await this.campaignService.getCampaignById(campaignId);

    const user = await this.prisma.user.findUnique({
      where: userEmail,
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    // constructs the html
    const html = this.constructHTML(campaign, user, lang);

    // makes a pdf of it
    const pdfMakeHTML = htmlToPdfMake(html, {
      window: window,
      defaultStyles: {
        h1: {
          fontSize: 18,
          margin: 0,
        },
        h2: {
          fontSize: 16,
          margin: 0,
        },
        h3: {
          fontSize: 14,
          margin: 0,
        },
        ul: {
          fontSize: 10,
        },
        table: {
          fontSize: 10,
          margin: 0,
        },
        p: {
          fontSize: 10,
          margin: 0,
        },
      },
    });

    // use Lucia Sans as we only have Unit Rounded as webfont
    const fonts = {
      Lucia: {
        normal: path.resolve('./fonts/LSANS.TTF'),
        bold: path.resolve('./fonts/LSANSD.TTF'),
        italics: path.resolve('./fonts/LSANSI.TTF'),
        bolditalics: path.resolve('./fonts/LSANSDI.TTF'),
      },
    };

    const printer = new PdfPrinter(fonts);

    this.addCampaignStylePropertyToElements(pdfMakeHTML);

    this.campaignDataCols(pdfMakeHTML);

    const docDefinition = {
      content: pdfMakeHTML,
      defaultStyle: { font: 'Lucia' },
      pageOrientation: 'landscape',
    };
    const pdfDocGenerator = printer.createPdfKitDocument(docDefinition);
    pdfDocGenerator.end();

    return pdfDocGenerator;
  }

  constructHTML(campaign: Campaign, user: User, lang: string) {
    // prettier-ignore
    let html =
      `<h1>${this.i18n.t('pdf.overviewTitle', { 
        lang: lang,
        args: {
          campaignName: this.sanService.sanitize(campaign.name),
          date: this.appService.formatLocaleDate(new Date(), lang)
        } 
      })}</h1>
      <div>
        <div class="campaignProperties">
          <div>
            <p><b>${this.i18n.t('pdf.status', { lang: lang })}</b>: ${this.i18n.t(`status.${this.calculationsService.getCampaignStatus(campaign)}`, { lang: lang })}</p>
            <p><b>${this.i18n.t('pdf.createdOn', { lang: lang })}</b>: ${this.appService.formatLocaleDate(new Date(), lang)}</p>`;

    if (campaign.openingDate) {
      html += `<p><b>${this.i18n.t('pdf.start', {
        lang: lang,
      })}</b>: ${this.appService.formatLocaleDate(campaign.openingDate, lang)}
      </p>`;
    }

    if (campaign.closingDate) {
      html += `<p><b>${this.i18n.t('pdf.end', {
        lang: lang,
      })}</b>: ${this.appService.formatLocaleDate(
        campaign.closingDate,
        lang,
      )}</p>`;
    }

    html += `<p><b>${this.i18n.t('pdf.gradingScale', {
      lang: lang,
    })}</b>: 1 - ${campaign.maxPoints}</p>
            <p><b>${this.i18n.t('pdf.numberOfGroups', { lang: lang })}</b>: ${
              campaign.groups.length
            }</p><p><b>${this.i18n.t('pdf.language', {
              lang: lang,
            })}</b>: ${campaign.language.toUpperCase()}</p><p><b>${
              campaign.allowCommentsForPeers
                ? this.i18n.t('pdf.P2PCommentsAllowed', { lang: lang })
                : this.i18n.t('pdf.P2PCommentsDisallowed', { lang: lang })
            }</b></p>
          </div>
          <div>
            <p><b>${this.i18n.t('pdf.criteria', { lang: lang })}(${this.i18n.t(
              'pdf.weight',
              { lang: lang },
            )})</b></p>
              ${this.getCriteriaHTML(campaign.criteria)}
          </div>
        </div>
      </div>
      ${this.getGroupHTML(
        user,
        campaign.groups,
        campaign.criteria,
        lang,
        gradeRoundingOf(campaign),
      )}
      <ul>
        <li>${this.i18n.t('pdf.overviewPeerAssessmentAverageExplanation', {
          lang: lang,
        })}</li>
        <li>${this.i18n.t('pdf.overviewGroupAverageExplanation', {
          lang: lang,
        })}</li>
      </ul>`;

    // replaces new lines and tabs with empty strings
    html = html.replace(/(\n|\s{2,})/g, '');

    return html;
  }

  getGroupHTML(
    user: User,
    groups: Group[],
    criteria: Criteria[],
    lang: string,
    gradeRounding = 0.5,
  ): string {
    let groupHTML = '';
    groups.forEach((group) => {
      // prettier-ignore
      groupHTML +=
        `<nav>
          <h3>${this.i18n.t('pdf.groupOverview', { 
            lang: lang,
            args: {
              groupNumber: group.number
            } 
          })}</h3>
            ${this.getPeersHTML(group.peers, group, lang, gradeRounding)}
            <p><b>${this.i18n.t('pdf.groupAverage', { 
              lang: lang,
              args: {
                groupNumber: group.number
              } 
            })}:</b> ${this.calculationsService.getGroupAverage(group)}</p>
          <section>
            ${this.getPendingPeersHTML(group, criteria, lang)}
            ${this.getComments(user, group.comments, lang)}
          </section>
        </nav>
        <svg viewBox="0 0 760 30" ><line x1="0" y1="10" x2="760" y2="10" stroke="#ffbb02" /></svg>`;
    });
    return groupHTML;
  }

  getPeersHTML(peers: Peer[], group: Group, lang: string, gradeRounding = 0.5) {
    // final grade of a peer, rounded like set in the campaign
    const grade = (peer: Peer) =>
      this.calculationsService.getPeersGrade({ gradeRounding }, group, peer);

    let peersHTML = '';
    if (peers.length > 7) {
      const midIndex = Math.ceil(peers.length / 2);

      // top row
      let leftSide = `<table>
          <tr>
            <th>
              <span>${this.i18n.t('pdf.gradingTo', {
                lang: lang,
              })}</span><span>${this.i18n.t('pdf.gradingFrom', {
                lang: lang,
              })}</span>
            </th>`;
      let rightSide = `<table>
          <tr>
            <th>
              <span>${this.i18n.t('pdf.gradingTo', {
                lang: lang,
              })}</span><span>${this.i18n.t('pdf.gradingFrom', {
                lang: lang,
              })}</span>
            </th>`;

      peers.forEach((peer: Peer, index: number) => {
        if (index < midIndex)
          leftSide += `<th>${this.sanService.sanitize(
            peer.lastName,
          )} ${this.sanService.sanitize(peer.firstName)}</th>`;
        else
          rightSide += `<th>${this.sanService.sanitize(
            peer.lastName,
          )} ${this.sanService.sanitize(peer.firstName)}</th>`;
      });

      leftSide += '</tr>';
      rightSide += '</tr>';

      // mid rows
      peers.forEach((peer: Peer) => {
        leftSide += `
          <tr>
            <td>
              ${this.sanService.sanitize(
                peer.lastName,
              )} ${this.sanService.sanitize(peer.firstName)}
            </td>
            ${this.getAverage(
              peers.filter((peer, index) => index < midIndex),
              peer,
              group,
            )}
          </tr>`;
        rightSide += `
          <tr>
            <td>
              ${this.sanService.sanitize(
                peer.lastName,
              )} ${this.sanService.sanitize(peer.firstName)}
            </td>
            ${this.getAverage(
              peers.filter((peer, index) => index >= midIndex),
              peer,
              group,
            )}
          </tr>`;
      });

      // bottom row
      leftSide += `
        <tr>
          <td>${this.i18n.t('pdf.peerAssessmentAverage', {
            lang: lang,
          })}:</td>`;
      rightSide += `
        <tr>
          <td>${this.i18n.t('pdf.peerAssessmentAverage', {
            lang: lang,
          })}:</td>`;

      peers.forEach((peer: Peer, index: number) => {
        if (index < midIndex)
          leftSide += `
              <td>
                ${grade(peer)}
              </td>`;
        else
          rightSide += `
              <td>
                ${grade(peer)}
              </td>`;
      });

      rightSide += '</tr></table>';
      leftSide += '</tr></table>';

      peersHTML += leftSide + rightSide;
    } else {
      // top row
      peersHTML += `
        <table>
          <tr>
            <th>
              <span>${this.i18n.t('pdf.gradingTo', {
                lang: lang,
              })}</span><span>${this.i18n.t('pdf.gradingFrom', {
                lang: lang,
              })}</span>
            </th>`;
      peers.forEach((peer) => {
        peersHTML +=
          '<th>' +
          this.sanService.sanitize(peer.lastName) +
          ' ' +
          this.sanService.sanitize(peer.firstName) +
          '</th>';
      });
      peersHTML += '</tr>';

      // mid rows
      peers.forEach((peer) => {
        peersHTML += `
            <tr>
              <td>
                ${this.sanService.sanitize(
                  peer.lastName,
                )} ${this.sanService.sanitize(peer.firstName)}
              </td>
              ${this.getAverage(peers, peer, group)}
            </tr>`;
      });

      // bottom row
      peersHTML += `<tr><td>${this.i18n.t('pdf.peerAssessmentAverage', {
        lang: lang,
      })}:</td>`;
      peers.forEach((peer) => {
        peersHTML += '<td>' + grade(peer) + '</td>';
      });
      peersHTML += '</tr></table>';
    }

    return peersHTML;
  }

  getPendingPeersHTML(group: Group, criteria: Criteria[], lang: string) {
    let html = '';

    const pendingPeers = group.peers.filter((peer) => {
      const gradingsFromPeer = group.gradings.filter(
        (grading) => grading.fromPeer.peerId === peer.peerId,
      );

      return gradingsFromPeer.length < group.peers.length * criteria.length;
    });

    if (pendingPeers.length > 0) {
      html += `<pending><h3>${this.i18n.t('pdf.pendingPeers', {
        lang: lang,
      })}:</h3><ul>`;

      for (const peer of pendingPeers) {
        html += `<li>${this.sanService.sanitize(
          peer.lastName,
        )} ${this.sanService.sanitize(peer.firstName)}</li>`;
      }

      html += '</ul></pending>';
    }

    return html;
  }

  getComments(user: User, comments: PeerComment[], lang: string) {
    let html = '<comments>';

    const commentsToAdmin = comments.filter(
      (comment) => comment.toUser.userId == user.userId,
    );

    if (commentsToAdmin.length > 0) {
      html += `<h3>${this.i18n.t('pdf.commentsRecieved', {
        lang: lang,
      })}</h3>
      <table id='comments-table'>
      <tr>
        <th>${this.i18n.t('pdf.author', {
          lang: lang,
        })}</th>
        <th>${this.i18n.t('pdf.comment', {
          lang: lang,
        })}</th>
      </tr>`;

      commentsToAdmin.forEach((comment) => {
        html += `<tr>
          <td>${this.sanService.sanitize(
            comment.fromPeer.firstName,
          )} ${this.sanService.sanitize(comment.fromPeer.lastName)}
          </td>
          <td> 
            ${this.sanService.sanitize(comment.text)}
          </td>
        </tr>`;
      });

      html += `</table>`;
    }

    html += '</comments>';

    return html;
  }

  getAverage(peers: Peer[], toPeer: Peer, group: Group) {
    let html = '';
    peers.forEach((fromPeer: Peer) => {
      html +=
        '<td>' +
        this.calculationsService.getPeerToPeerAverage(group, fromPeer, toPeer) +
        '</td>';
    });

    return html;
  }

  addCampaignStylePropertyToElements(elements: any) {
    for (const [index, element] of elements.entries()) {
      element.style = element.nodeName;
      if (
        element.nodeName == 'H1' ||
        element.nodeName == 'H2' ||
        element.nodeName == 'H3'
      ) {
        element.margin = [0, 20, 2, 10];
      }
      if (element.stack && element.stack.length > 0) {
        this.addCampaignStylePropertyToElements(element.stack);
      }
      if (element.nodeName == 'LEGEND') {
        element.margin = [0, 20];
      }
      // add pagebreak after group if not last one
      if (element.nodeName == 'SVG' && index !== elements.length - 2) {
        element.pageBreak = 'after';
      }
      if (element.nodeName == 'TABLE') {
        element.margin = [0, 0, 2, 20];
        // zebra style of table and definition of line drawing
        element.layout = {
          fillColor: function (rowIndex: any) {
            return rowIndex % 2 === 0 ? null : '#c1c9d1';
          },
          hLineWidth: () => 0,
          vLineWidth: () => 0,
        };

        //auto width of tables
        const width = Array(element.table.body[0].length).fill('*');
        width[0] = 'auto';
        element.table.widths = width;

        // if the table in question is not the comments table
        if (element.table.body.length > 0 && element.id != 'comments-table') {
          // style top left corner labels
          element.table.body[0][0].text[0].alignment = 'right';
          const fillText = element.table.body[0][0].text.pop();
          const text = JSON.parse(JSON.stringify(fillText));
          fillText.text = '';
          const arr = Array(element.table.body[0].length).fill(fillText);
          arr[0] = text;
          element.table.body.splice(1, 0, arr);
        }
      }
    }
  }

  /**
   * splits campaign info below header into 2 columns
   * @param elements
   */
  campaignDataCols(elements: any) {
    const cols = JSON.parse(JSON.stringify(elements[1].stack[0].stack));

    delete elements[1].stack[0].stack;

    elements[1].stack[0].columns = cols;
    elements[1].stack[0].columnGap = 10;

    for (const groupNode of elements.filter((node) => node.nodeName == 'NAV')) {
      const section = groupNode.stack.find(
        (node) => node.nodeName === 'SECTION',
      );

      if (section && section.stack) {
        const index = groupNode.stack.indexOf(section);
        const columns = JSON.parse(
          JSON.stringify(groupNode.stack[index].stack),
        );

        delete groupNode.stack[index].stack;

        groupNode.stack[index].columns = columns;
        groupNode.stack[index].columnGap = 10;
      }
    }
  }

  async getReviewPDF(url: string, lang: string): Promise<any> {
    // getting data from db
    const query = await this.prisma.groupPeerConnection.findUnique({
      where: { link: url },
      include: {
        peer: true,
        group: {
          include: {
            campaign: {
              include: {
                criteria: true,
              },
            },
            peers: {
              include: {
                peer: true,
              },
            },
            comments: {
              where: {
                toUser: {
                  peer: {
                    groups: {
                      some: {
                        link: url,
                      },
                    },
                  },
                },
              },
              include: {
                fromPeer: true,
                toUser: true,
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

    // preparing data
    const peer = query.peer;

    const { comments, peers, gradings, campaignId, campaign, ...rest } =
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
      comments,
      peers: formatPeers,
      gradings: formatGradings,
      ...rest,
    };

    const review: ReviewData = {
      peer,
      group,
      campaign,
    };

    // makes html and then the pdf out of it
    const html = this.constructReviewHTML(review, lang);

    const pdfMakeHTML = htmlToPdfMake(html, {
      window: window,
      defaultStyles: {
        h1: {
          fontSize: 18,
          margin: 0,
        },
        h2: {
          fontSize: 16,
          margin: 0,
        },
        h3: {
          fontSize: 14,
          margin: 0,
        },
        ul: {
          fontSize: 10,
        },
        table: {
          fontSize: 10,
          margin: 0,
        },
        p: {
          fontSize: 10,
          margin: 0,
        },
      },
    });

    // use Lucia Sans as we only have Unit Rounded as webfont
    const fonts = {
      Lucia: {
        normal: path.resolve('./fonts/LSANS.TTF'),
        bold: path.resolve('./fonts/LSANSD.TTF'),
        italics: path.resolve('./fonts/LSANSI.TTF'),
        bolditalics: path.resolve('./fonts/LSANSDI.TTF'),
      },
    };

    const printer = new PdfPrinter(fonts);

    this.addStylePropertyToElements(pdfMakeHTML);

    this.campaignDataCols(pdfMakeHTML);

    const docDefinition = {
      content: pdfMakeHTML,
      styles: { H3: { fontSize: 12 } },
      defaultStyle: { font: 'Lucia' },
      pageOrientation: 'landscape',
    };

    const pdfDocGenerator = printer.createPdfKitDocument(docDefinition);

    pdfDocGenerator.end();

    return pdfDocGenerator;
  }

  constructReviewHTML(review: ReviewData, lang: string) {
    const openingDate = new Date(review.campaign.openingDate);

    const closingDate = new Date(review.campaign.closingDate);
    // prettier-ignore
    let html =
      `<h1>${this.i18n.t("pdf.title", {
        lang: lang,
        args: {
          lastName: this.sanService.sanitize(review.peer.lastName),
          firstName: this.sanService.sanitize(review.peer.firstName),
          date: this.appService.formatLocaleDate(new Date(), lang)
        }
      })}</h1>
      <div>
        <div class="campaignProperties">
          <div>
            <p><strong>${this.i18n.t("pdf.campaignName", {lang: lang})}:</strong> ${this.sanService.sanitize(review.campaign.name)}</p>
            <p><b>${this.i18n.t("pdf.groupNumber", {lang: lang})}:</b> ${review.group.number}</p>
            <p><b>${this.i18n.t("pdf.groupSize", {lang: lang})}:</b> ${review.group.peers.length}</p>
            <p><b>${this.i18n.t("pdf.gradingScale", {lang: lang})}:</b> 1 - ${review.campaign.maxPoints}</p>`;

    if (
      this.calculationsService.getCampaignStatus(review.campaign as Campaign) ==
      'läuft'
    ) {
      html += `<p><b>${this.i18n.t('pdf.campaignStart', {
        lang: lang,
      })}:</b> ${this.appService.formatLocaleDate(openingDate, lang)}</p>`;
    }
    if (
      this.calculationsService.getCampaignStatus(review.campaign as Campaign) ==
      'abgeschlossen'
    ) {
      html += `<p><b>${this.i18n.t('pdf.campaignPeriod', {
        lang: lang,
      })}:</b> ${this.appService.formatLocaleDate(
        openingDate,
        lang,
      )} - ${this.appService.formatLocaleDate(closingDate, lang)}</p>`;
    }

    html += `</div>
          <div>
            <p>
              <b>${this.i18n.t('pdf.criteria', { lang: lang })} (${this.i18n.t(
                'pdf.weight',
                { lang: lang },
              )}):</b>
            </p>
            ${this.getCriteriaHTML(review.campaign.criteria)}
          </div>
        </div>
      </div>
      <svg viewBox="0 0 760 30" ><line x1="0" y1="10" x2="760" y2="10" stroke="#f4c72c" /></svg>
      <section class="peerGradingReview">
        ${this.getReviewTable(review, lang)}
        <svg viewBox="-100 -30 660 180" width="660" height="180">
          <g>
            <rect x="0" y="0" width="120" height="100" fill="#c1c9d1"></rect>
            <text x="60" y="60" text-anchor="middle" font-size="35" font-family="Lucida" fill="black">${this.calculationsService.getPeersGrade(
              review.campaign,
              review.group,
              review.peer,
            )}</text>
            <text x="60" y="120" text-anchor="middle" font-size="10" font-family="Lucida" fill="black">${this.i18n.t(
              'pdf.peerAssessment',
              { lang: lang },
            )}</text>
          </g>
          <g>
            <rect x="220" y="0"  width="120" height="100" fill="#c1c9d1"></rect>
            <text x="280" y="60" text-anchor="middle" font-size="35" font-family="Lucida" fill="black">${this.calculationsService.getGroupAverage(
              review.group,
            )}</text>
            <text x="280" y="120" text-anchor="middle" font-size="10" font-family="Lucida" fill="black">${this.i18n.t(
              'pdf.groupAverage',
              { lang: lang },
            )}</text>
          </g>
          <g>
            <rect x="430" y="0"  width="120" height="100" fill="#c1c9d1"></rect>
            <text x="490" y="60" text-anchor="middle" font-size="35" font-family="Lucida" fill="black">${this.calculationsService.getPeerReviewDifference(
              review.group,
              review.peer,
              gradeRoundingOf(review.campaign),
            )}</text>
            <text x="490" y="120" text-anchor="middle" font-size="10" font-family="Lucida" fill="black">${this.i18n.t(
              'pdf.devation',
              { lang: lang },
            )}</text>
          </g>
        </svg>
      </section>`;

    html += `<div>
        <ul>
          <li>${this.i18n.t('pdf.peerAssessment', {
            lang: lang,
          })}: ${this.i18n.t('pdf.peerAssessmentExplanation', {
            lang: lang,
          })}</li>
          <li>${this.i18n.t('pdf.groupAverage', {
            lang: lang,
          })}: ${this.i18n.t('pdf.groupAverageExplanation', {
            lang: lang,
          })}</li>
          <li>${this.i18n.t('pdf.devation', {
            lang: lang,
          })}: ${this.i18n.t('pdf.devationExplanation', {
            lang: lang,
          })}</li>
        </ul>
      </div>`;

    if (
      review.group.comments.length > 0 &&
      review.campaign.allowCommentsForPeers
    ) {
      html += this.getReviewComments(review, lang);
    }

    // replaces new lines and tabs with empty strings
    html = html.replace(/(\n|\s{2,})/g, '');

    return html;
  }

  getCriteriaHTML(criteria: { [key: string]: any }[]): string {
    let criteriaHTML = '';
    criteria.forEach((criteria) => {
      criteriaHTML += `<p>${this.sanService.sanitize(criteria.name)} (${
        criteria.weight
      })</p>`;
    });
    return criteriaHTML;
  }

  getReviewTable(review: ReviewData, lang: string) {
    let html = `<table id="review-table"><tr><th></th>`;
    const criteria = review.campaign.criteria;
    criteria.forEach((criteria) => {
      html += `<th>${this.sanService.sanitize(criteria.name)} (${
        criteria.weight
      })</th>`;
    });
    html += `<th>${this.i18n.t('pdf.average', {
      lang: lang,
    })}</th></tr><tr><th>${this.i18n.t('pdf.peerAssessment', {
      lang: lang,
    })}</th>`;
    criteria.forEach((criteria) => {
      html +=
        '<td>' +
        this.calculationsService.getPeersThirdPartyAverageByCriteria(
          criteria,
          review.group,
          review.peer,
        ) +
        '</td>';
    });
    html +=
      `<th>` +
      this.calculationsService.getPeersGrade(
        review.campaign,
        review.group,
        review.peer,
      ) +
      `</th></tr><tr class="selfGrading"><th>${this.i18n.t(
        'pdf.selfAssessment',
        { lang: lang },
      )}</th>`;
    criteria.forEach((criteria) => {
      html +=
        '<td>' +
        this.calculationsService.getGradingPointsByPeersAndCriteria(
          review.group,
          review.peer,
          review.peer,
          criteria,
        ) +
        '</td>';
    });
    html +=
      `<th>` +
      this.calculationsService.getPeersSelfAverage(review.group, review.peer) +
      `</th></tr></table>`;
    return html;
  }

  getReviewComments(review: ReviewData, lang: string) {
    // (bug fixed: the language was missing, so headings were always English)
    let html = `<h3>${this.i18n.t('pdf.commentsRecieved', { lang })}</h3>
    <table>
      <tr>
          <th>${this.i18n.t('pdf.author', { lang })}</th>
          <th>${this.i18n.t('pdf.comment', { lang })}</th>
      </tr>`;

    for (const peer of review.group.peers) {
      if (review.peer.peerId !== peer.peerId) {
        html += `
    <tr>
      <th>${this.sanService.sanitize(
        peer.firstName,
      )} ${this.sanService.sanitize(peer.lastName)}</th>
      <td>${this.sanService.sanitize(
        review.group.comments.find((c) => c.fromPeer.peerId == peer.peerId)
          .text,
      )}</td>
    </tr>
    `;
      }
    }

    html += `</table>`;

    return html;
  }

  addStylePropertyToElements(elements: any) {
    elements.forEach((element: any) => {
      element.style = element.nodeName;
      if (element.stack && element.stack.length > 0) {
        this.addStylePropertyToElements(element.stack);
      }

      if (element.nodeName == 'TABLE') {
        element.margin = [0, 0, 2, 20];

        //auto width of tables
        const width = Array(element.table.body[0].length).fill('*');
        width[0] = 'auto';
        element.table.widths = width;

        // setting lineWidths to zero
        element.layout = {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
        };

        // setting last line to self grading color if it's the review table
        if (element.table.body.length > 0 && element.id == 'review-table') {
          element.table.body[element.table.body.length - 1].forEach((el) => {
            el.fillColor = '#87b9c8';
          });
        }
      }
    });
  }
}
