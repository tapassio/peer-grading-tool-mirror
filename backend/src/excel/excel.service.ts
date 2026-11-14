import { Injectable } from '@nestjs/common';
import { Campaign, Criteria, Group, Peer, PeerComment } from '../interfaces';
import * as ExcelJS from 'exceljs';
import { CalculationsService, gradeRoundingOf } from '../calculations/calculations.service';
import { CampaignService } from '../campaign/campaign.service';
import { I18nService } from 'nestjs-i18n';
import { SanitizeService } from '../sanitize/sanitize.service';

/**
 * Creates an Excel worksheet that holds all campaign data
 */
@Injectable()
export class ExcelService {
  constructor(
    private calculationsService: CalculationsService,
    private campaignService: CampaignService,
    private i18n: I18nService,
    private sanService: SanitizeService,
  ) {}

  /**
   * the only public function. gets the campaign data and generates a summary sheet as well as a sheet for each group
   * @param campaignId
   * @returns the excel workbook
   */
  public async getCampaignExcel(campaignId: number, lang: string) {
    let campaign = await this.campaignService.getCampaignById(campaignId);

    const workbook = new ExcelJS.Workbook();

    this.addSummaryWorkSheet(workbook, campaign, lang);

    for (let group of campaign.groups) {
      this.addGroupWorkSheet(workbook, campaign, group, lang);
    }

    return workbook;
  }

  /**
   * generates the first worksheet in the excel file. styling is applied at the end.
   * @param workbook
   * @param campaign
   */
  private addSummaryWorkSheet(
    workbook: ExcelJS.Workbook,
    campaign: Campaign,
    lang: string,
  ) {
    // preparing translations
    const yes: string = this.i18n.t('excel.yes', {
      lang: lang,
    });
    const no: string = this.i18n.t('excel.no', {
      lang: lang,
    });

    const summarySheet = workbook.addWorksheet(
      this.i18n.t('excel.overviewSheetTitle', {
        lang: lang,
      }),
    );

    // the following arrays contain rows for styling purposes
    const boldRows: ExcelJS.Row[] = [];
    const borderRows: ExcelJS.Row[][] = [];
    const highRows: ExcelJS.Row[] = [];

    // defining columns
    summarySheet.columns = [
      { key: 'col1', width: 30 },
      { key: 'col2', width: 30 },
      { key: 'col3', width: 21 },
      { key: 'col4', width: 21 },
      { key: 'col5', width: 21 },
      { key: 'col6', width: 21 },
      { key: 'col7', width: 21 },
      { key: 'col8', width: 21 },
    ];

    // general campaign data
    boldRows.push(
      summarySheet.addRow({
        col1: this.i18n.t('excel.general', {
          lang: lang,
        }),
      }),
    );

    summarySheet.addRow({
      col1: this.i18n.t('excel.campaignName', {
        lang: lang,
      }),
      col2: this.sanService.sanitize(campaign.name),
      col4: this.i18n.t('excel.exportDate', {
        lang: lang,
      }),
      col5: this.formatDate(new Date(), lang),
    });
    summarySheet.addRow({
      col1: this.i18n.t('excel.status', {
        lang: lang,
      }),
      col2: this.i18n.t(
        `status.${this.calculationsService.getCampaignStatus(campaign)}`,
        {
          lang: lang,
        },
      ),
      col4: this.i18n.t('excel.createdOn', {
        lang: lang,
      }),
      col5: this.formatDate(campaign.creationDate, lang),
    });
    summarySheet.addRow({
      col1: this.i18n.t('excel.maxPoints', {
        lang: lang,
      }),
      col2: campaign.maxPoints,
      col4: campaign.openingDate
        ? this.i18n.t('excel.start', {
            lang: lang,
          })
        : null,
      col5: campaign.openingDate
        ? this.formatDate(campaign.openingDate, lang)
        : null,
    });
    summarySheet.addRow({
      col1: this.i18n.t('excel.numberOfGroups', {
        lang: lang,
      }),
      col2: campaign.groups.length,
      col4: campaign.closingDate
        ? this.i18n.t('excel.end', {
            lang: lang,
          })
        : null,
      col5: campaign.closingDate
        ? this.formatDate(campaign.closingDate, lang)
        : null,
    });
    summarySheet.addRow({
      col1: this.i18n.t('excel.language', {
        lang: lang,
      }),
      col2: campaign.language.toUpperCase(),
    });
    summarySheet.addRow({
      col1: this.i18n.t('excel.P2PCommentsAllowed', {
        lang: lang,
      }),
      col2: campaign.allowCommentsForPeers ? yes : no,
    });

    summarySheet.addRow({});

    // lists criteria and their weight
    boldRows.push(
      summarySheet.addRow({
        col1: this.i18n.t('excel.criteria', {
          lang: lang,
        }),
      }),
    );
    const criteriaHeaderRow = summarySheet.addRow({
      col1: this.i18n.t('excel.name', {
        lang: lang,
      }),
      col2: this.i18n.t('excel.weight', {
        lang: lang,
      }),
    });
    boldRows.push(criteriaHeaderRow);
    borderRows.push([criteriaHeaderRow]);
    for (let criteria of campaign.criteria) {
      borderRows.push([
        summarySheet.addRow({
          col1: this.sanService.sanitize(criteria.name),
          col2: criteria.weight,
        }),
      ]);
    }
    summarySheet.addRow({});

    // lists general group data
    boldRows.push(
      summarySheet.addRow({
        col1: this.i18n.t('excel.groupOverview', {
          lang: lang,
        }),
      }),
    );
    const groupsSummaryHeaderRow = summarySheet.addRow({
      col1: this.i18n.t('excel.number', {
        lang: lang,
      }),
      col2: this.i18n.t('excel.numberOfPeers', {
        lang: lang,
      }),
      col3: this.i18n.t('excel.gradingCompletionPercentage', {
        lang: lang,
      }),
      col4: this.i18n.t('excel.numberOfComments', {
        lang: lang,
      }),
      col5: this.i18n.t('excel.gradingsComplete', {
        lang: lang,
      }),
      col6: this.i18n.t('excel.groupAverage', {
        lang: lang,
      }),
    });
    boldRows.push(groupsSummaryHeaderRow);
    borderRows.push([groupsSummaryHeaderRow]);

    for (let group of campaign.groups) {
      borderRows.push([
        summarySheet.addRow({
          col1: group.number,
          col2: group.peers.length,
          col3: this.getGroupCompletenes(group, campaign),
          col4: group.comments.length,
          col5: this.gradingsComplete(group, campaign) ? yes : no,
          col6: this.calculationsService.getGroupAverage(group),
        }),
      ]);
    }

    summarySheet.addRow({});

    // lists all peers
    const studentsHeaderRow = summarySheet.addRow({
      col1: this.i18n.t('excel.student', {
        lang: lang,
      }),
      col2: this.i18n.t('excel.email', {
        lang: lang,
      }),
      col3: this.i18n.t('excel.matriculationNumber', {
        lang: lang,
      }),
      col4: this.i18n.t('excel.groupNumber', {
        lang: lang,
      }),
      col5: this.i18n.t('excel.gradingsComplete', {
        lang: lang,
      }),
      col6: this.i18n.t('excel.groupAverage', {
        lang: lang,
      }),
      col7: this.i18n.t('excel.peerAssessmentAverageOfPeers', {
        lang: lang,
      }),
      col8: this.i18n.t('excel.deviation', {
        lang: lang,
      }),
    });
    highRows.push(studentsHeaderRow);
    boldRows.push(studentsHeaderRow);
    borderRows.push([studentsHeaderRow]);

    for (let group of campaign.groups) {
      let groupPeerRows: ExcelJS.Row[] = [];

      for (const peer of group.peers) {
        groupPeerRows.push(
          summarySheet.addRow({
            col1: this.formatName(peer),
            col2: peer.email,
            col3: peer.matriculationNumber
              ? this.sanService.sanitize(peer.matriculationNumber)
              : '',
            col4: group.number,
            col5: this.gradingsComplete(group, campaign) ? yes : no,
            col6: this.calculationsService.getGroupAverage(group),
            // final grade and deviation, rounded like set in the campaign
            col7: this.calculationsService.getPeersGrade(campaign, group, peer),
            col8: this.calculationsService.getPeerReviewDifference(
              group,
              peer,
              gradeRoundingOf(campaign),
            ),
          }),
        );
      }

      borderRows.push(groupPeerRows);
    }

    // styling is applied here
    this.styleWorkSheet(summarySheet, boldRows, borderRows, [], highRows, []);
  }

  /**
   * generates all worksheets after the first containing group specific data
   * @param workbook
   * @param campaign
   * @param group
   */
  private addGroupWorkSheet(
    workbook: ExcelJS.Workbook,
    campaign: Campaign,
    group: Group,
    lang: string,
  ) {
    // preparing translations
    const yes: string = this.i18n.t('excel.yes', {
      lang: lang,
    });
    const no: string = this.i18n.t('excel.no', {
      lang: lang,
    });

    const groupSheet = workbook.addWorksheet(
      this.i18n.t('excel.groupSheetTitle', {
        lang: lang,
        args: {
          groupNumber: group.number,
        },
      }),
    );

    // the following arrays contain rows for styling purposes
    const boldRows: ExcelJS.Row[] = [];
    const borderRows: ExcelJS.Row[][] = [];
    const firstBoldRows: ExcelJS.Row[] = [];
    const highRows: ExcelJS.Row[] = [];
    const mergeRows: ExcelJS.Row[] = [];

    // setting up columns
    let numberOfCols = 7;

    if (group.peers.length + 1 > numberOfCols) {
      numberOfCols = group.peers.length + 1;
    }

    if (campaign.criteria.length + 1 > numberOfCols) {
      numberOfCols = campaign.criteria.length + 1;
    }

    let columns = [];
    for (let i = 1; i <= numberOfCols; i++) {
      columns.push({ key: 'col' + i, width: 20 });
    }

    groupSheet.columns = columns;

    // generates general group data
    boldRows.push(
      groupSheet.addRow({
        col1: this.i18n.t('excel.overviewOfGroup', {
          lang: lang,
          args: {
            groupNumber: group.number,
          },
        }),
      }),
    );
    groupSheet.addRow({
      col1: this.i18n.t('excel.numberOfPeers', {
        lang: lang,
      }),
      col2: group.peers.length,
    });
    groupSheet.addRow({
      col1: this.i18n.t('excel.gradingCompletionPercentage', {
        lang: lang,
      }),
      col2: this.getGroupCompletenes(group, campaign),
    });
    groupSheet.addRow({
      col1: this.i18n.t('excel.gradingsComplete', {
        lang: lang,
      }),
      col2: this.gradingsComplete(group, campaign) ? yes : no,
    });
    groupSheet.addRow({
      col1: this.i18n.t('excel.groupAverage', {
        lang: lang,
      }),
      col2: this.calculationsService.getGroupAverage(group),
    });
    groupSheet.addRow({
      col1: this.i18n.t('excel.numberOfComments', {
        lang: lang,
      }),
      col2: group.comments.length,
    });

    groupSheet.addRow({});

    // generates general data for each peer of the group
    boldRows.push(
      groupSheet.addRow({
        col1: this.i18n.t('excel.peer', {
          lang: lang,
        }),
      }),
    );
    const participantsHeaderRow = groupSheet.addRow({
      col1: this.i18n.t('excel.firstName', {
        lang: lang,
      }),
      col2: this.i18n.t('excel.lastName', {
        lang: lang,
      }),
      col3: this.i18n.t('excel.matriculationNumber', {
        lang: lang,
      }),
      col4: this.i18n.t('excel.email', {
        lang: lang,
      }),
      col5: this.i18n.t('excel.gradingsSent', {
        lang: lang,
      }),
      col6: this.i18n.t('excel.selfAverage', {
        lang: lang,
      }),
      col7: this.i18n.t('excel.peerAssessmentAverage', {
        lang: lang,
      }),
    });
    boldRows.push(participantsHeaderRow);
    borderRows.push([participantsHeaderRow]);

    for (let peer of group.peers) {
      const gradingsSent =
        group.gradings.filter(
          (grading) => grading.fromPeer.peerId == peer.peerId,
        ).length >=
        group.peers.length * campaign.criteria.length;

      borderRows.push([
        groupSheet.addRow({
          col1: this.sanService.sanitize(peer.lastName),
          col2: this.sanService.sanitize(peer.firstName),
          col3: peer.matriculationNumber
            ? this.sanService.sanitize(peer.matriculationNumber)
            : '',
          col4: peer.email,
          col5: gradingsSent ? yes : no,
          col6: this.calculationsService.getPeersSelfAverage(group, peer),
          col7: this.calculationsService.getPeersGrade(campaign, group, peer),
        }),
      ]);
    }

    groupSheet.addRow({});

    // generates a table for each peer to peer average as well as the third party average
    boldRows.push(
      groupSheet.addRow({
        col1: this.i18n.t('excel.gradingOverview', {
          lang: lang,
        }),
      }),
    );
    let gradingHeaderRow: any = {};
    gradingHeaderRow.col1 = `${this.i18n.t('excel.gradingTo', {
      lang: lang,
    })} → \r\n ${this.i18n.t('excel.gradingFrom', {
      lang: lang,
    })} ↓`;
    for (let i = 0; i < group.peers.length; i++) {
      gradingHeaderRow['col' + (i + 2)] = this.formatName(group.peers[i]);
    }
    gradingHeaderRow = groupSheet.addRow(gradingHeaderRow);
    boldRows.push(gradingHeaderRow);
    borderRows.push([gradingHeaderRow]);
    highRows.push(gradingHeaderRow);

    for (let i = 0; i < group.peers.length; i++) {
      let gradingRow: any = {};
      gradingRow.col1 = this.formatName(group.peers[i]);
      for (let j = 0; j < group.peers.length; j++) {
        gradingRow['col' + (j + 2)] =
          this.calculationsService.getPeerToPeerAverage(
            group,
            group.peers[i],
            group.peers[j],
          );
      }
      gradingRow = groupSheet.addRow(gradingRow);
      borderRows.push([gradingRow]);
      firstBoldRows.push(gradingRow);
    }

    let gradingSummaryRow: any = {};
    gradingSummaryRow.col1 = this.i18n.t('excel.peerAssessmentAverage', {
      lang: lang,
    });
    for (let i = 0; i < group.peers.length; i++) {
      gradingSummaryRow['col' + (i + 2)] =
        this.calculationsService.getPeersGrade(campaign, group, group.peers[i]);
    }
    gradingSummaryRow = groupSheet.addRow(gradingSummaryRow);
    borderRows.push([gradingSummaryRow]);
    firstBoldRows.push(gradingSummaryRow);

    groupSheet.addRow({});

    // if there are comments sent in this group, they are generated here
    if (group.comments.length > 0) {
      boldRows.push(
        groupSheet.addRow({
          col1: this.i18n.t('excel.comments', {
            lang: lang,
          }),
        }),
      );

      const commentHeaderRow = groupSheet.addRow({
        col1: this.i18n.t('excel.commentFrom', {
          lang: lang,
        }),
        col2: this.i18n.t('excel.commentFor', {
          lang: lang,
        }),
        col3: this.i18n.t('excel.comment', {
          lang: lang,
        }),
      });

      boldRows.push(commentHeaderRow);
      borderRows.push([commentHeaderRow]);
      mergeRows.push(commentHeaderRow);

      for (const peer of group.peers) {
        const commentsFromPeer = group.comments.filter(
          (comment: PeerComment) => comment.fromPeer.peerId === peer.peerId,
        );

        for (const [index, comment] of commentsFromPeer.entries()) {
          const commentRow = groupSheet.addRow({
            col1: index == 0 ? this.formatName(comment.fromPeer) : '',
            col2: this.formatName(comment.toUser),
            col3: this.sanService.sanitize(comment.text),
          });
          borderRows.push([commentRow]);
          highRows.push(commentRow);
          mergeRows.push(commentRow);
          if (index == 0) {
            firstBoldRows.push(commentRow);
          }
        }
      }

      groupSheet.addRow({});
    }

    // generating tables for each individual grading by criteria
    for (const criteria of campaign.criteria) {
      const stylingRows = this.addIndividualGradingsByCriteria(
        groupSheet,
        group,
        criteria,
        lang,
      );
      boldRows.push(...stylingRows.boldRows);
      borderRows.push(...stylingRows.borderRows);
      firstBoldRows.push(...stylingRows.firstBoldRows);
      highRows.push(...stylingRows.highRows);
      mergeRows.push(...stylingRows.mergeRows);
    }

    // generating tables for each individual by peer
    for (const peer of group.peers) {
      const stylingRows = this.addIndividualGradingsByPeers(
        groupSheet,
        group,
        campaign,
        peer,
        lang,
      );
      boldRows.push(...stylingRows.boldRows);
      borderRows.push(...stylingRows.borderRows);
      firstBoldRows.push(...stylingRows.firstBoldRows);
      highRows.push(...stylingRows.highRows);
      mergeRows.push(...stylingRows.mergeRows);
    }

    // styling is applied here
    this.styleWorkSheet(
      groupSheet,
      boldRows,
      borderRows,
      firstBoldRows,
      highRows,
      mergeRows,
    );
  }

  /**
   * generates a table for individual gradings by criteria
   * @param groupSheet
   * @param group
   * @param criteria
   * @returns an object with arrays of rows for styling purposes
   */
  private addIndividualGradingsByCriteria(
    groupSheet: ExcelJS.Worksheet,
    group: Group,
    criteria: Criteria,
    lang: string,
  ): {
    boldRows: ExcelJS.Row[];
    borderRows: ExcelJS.Row[][];
    firstBoldRows: ExcelJS.Row[];
    highRows: ExcelJS.Row[];
    mergeRows: ExcelJS.Row[];
  } {
    // setting up styling arrays
    const boldRows: ExcelJS.Row[] = [];
    const borderRows: ExcelJS.Row[][] = [];
    const firstBoldRows: ExcelJS.Row[] = [];
    const highRows: ExcelJS.Row[] = [];
    const mergeRows: ExcelJS.Row[] = [];

    // title row
    const criteriaTitle = groupSheet.addRow({
      col1: this.i18n.t('excel.gradingsFromCriteria', {
        lang: lang,
        args: {
          criteriaName: this.sanService.sanitize(criteria.name),
        },
      }),
    });
    boldRows.push(criteriaTitle);
    mergeRows.push(criteriaTitle);

    // generating the header row
    let headerRowObject = {
      col1: `${this.i18n.t('excel.gradingTo', {
        lang: lang,
      })} → \r\n ${this.i18n.t('excel.gradingFrom', {
        lang: lang,
      })} ↓`,
    };

    for (const [index, toPeer] of group.peers.entries()) {
      headerRowObject['col' + (index + 2)] = this.formatName(toPeer);
    }

    const gradingsHeaderRow = groupSheet.addRow(headerRowObject);

    boldRows.push(gradingsHeaderRow);
    borderRows.push([gradingsHeaderRow]);
    highRows.push(gradingsHeaderRow);

    // generating the body rows
    for (const fromPeer of group.peers) {
      let gradingRowObject = {
        col1: this.formatName(fromPeer),
      };

      for (const [index, toPeer] of group.peers.entries()) {
        gradingRowObject['col' + (index + 2)] =
          this.calculationsService.getGradingPointsByPeersAndCriteria(
            group,
            fromPeer,
            toPeer,
            criteria,
          );
      }

      let gradingRow = groupSheet.addRow(gradingRowObject);
      borderRows.push([gradingRow]);
      firstBoldRows.push(gradingRow);
    }

    groupSheet.addRow({});

    return {
      boldRows,
      borderRows,
      firstBoldRows,
      highRows,
      mergeRows,
    };
  }

  /**
   * generates a table for individual gradings by peer
   * @param groupSheet
   * @param group
   * @param campaign
   * @param fromPeer
   * @returns an object with arrays of rows for styling purposes
   */
  private addIndividualGradingsByPeers(
    groupSheet: ExcelJS.Worksheet,
    group: Group,
    campaign: Campaign,
    fromPeer: Peer,
    lang: string,
  ): {
    boldRows: ExcelJS.Row[];
    borderRows: ExcelJS.Row[][];
    firstBoldRows: ExcelJS.Row[];
    highRows: ExcelJS.Row[];
    mergeRows: ExcelJS.Row[];
  } {
    // setting up styling arrays
    const boldRows: ExcelJS.Row[] = [];
    const borderRows: ExcelJS.Row[][] = [];
    const firstBoldRows: ExcelJS.Row[] = [];
    const highRows: ExcelJS.Row[] = [];
    const mergeRows: ExcelJS.Row[] = [];

    // title row
    const titleRow = groupSheet.addRow({
      col1: this.i18n.t('excel.gradingsFromPeer', {
        lang: lang,
        args: {
          fullName: this.formatName(fromPeer),
        },
      }),
    });
    boldRows.push(titleRow);
    mergeRows.push(titleRow);

    // generating the header row
    let headerRowObject = {
      col1: `${this.i18n.t('excel.criterion', {
        lang: lang,
      })} (${this.i18n.t('excel.weight', {
        lang: lang,
      })})`,
    };

    for (const [index, criteria] of campaign.criteria.entries()) {
      headerRowObject['col' + (index + 2)] = `${this.sanService.sanitize(
        criteria.name,
      )} (${criteria.weight})`;
    }
    const gradingsHeaderRow = groupSheet.addRow(headerRowObject);

    boldRows.push(gradingsHeaderRow);
    borderRows.push([gradingsHeaderRow]);

    // generating the body rows
    for (const toPeer of group.peers) {
      let gradingRowObject = {
        col1: this.formatName(toPeer),
      };

      for (const [index, criteria] of campaign.criteria.entries()) {
        gradingRowObject['col' + (index + 2)] =
          this.calculationsService.getGradingPointsByPeersAndCriteria(
            group,
            fromPeer,
            toPeer,
            criteria,
          );
      }

      const gradingRow = groupSheet.addRow(gradingRowObject);
      borderRows.push([gradingRow]);
      firstBoldRows.push(gradingRow);
    }

    groupSheet.addRow({});

    return {
      boldRows,
      borderRows,
      firstBoldRows,
      highRows,
      mergeRows,
    };
  }

  /**
   * this function applies styling to the given sheet.
   * @param sheet the worksheet where styling is applied
   * @param boldRows each cell is made bold
   * @param borderRows sets a border around each cell and alternates background-color on the rowArrays
   * @param firstBoldRows only the first cell is made bold
   * @param highRows enlarges the height of each row
   * @param mergeRows merges the last containing cell of each row to the column count of the sheet
   */
  private styleWorkSheet(
    sheet: ExcelJS.Worksheet,
    boldRows: ExcelJS.Row[],
    borderRows: ExcelJS.Row[][],
    firstBoldRows: ExcelJS.Row[],
    highRows: ExcelJS.Row[],
    mergeRows: ExcelJS.Row[],
  ) {
    // setting alignment of all rows to top left
    sheet.eachRow((row) => {
      row.alignment = { vertical: 'top', horizontal: 'left' };
    });

    // setting boldRows to bold and wrapText
    for (let row of boldRows) {
      row.font = { name: 'Calibri', family: 2, bold: true };
      row.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    }

    // setting borderRows border and alternating colors
    for (let [index, rowArray] of borderRows.entries()) {
      for (let row of rowArray) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          if (index % 2 == 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'c9e2ff' },
            };
          }
        });
      }
    }

    // setting firstBoldRows' first cell to bold
    for (const row of firstBoldRows) {
      row.getCell(1).font = { name: 'Calibri', family: 2, bold: true };
    }

    // setting highRows height
    for (const row of highRows) {
      row.height = 40;
    }

    // mergeRows cells' are merged from their last cell containing a value to the actual column count of the sheet
    for (const row of mergeRows) {
      sheet.mergeCells(
        row.number,
        row.actualCellCount,
        row.number,
        sheet.actualColumnCount,
      );
    }
  }

  /**
   * this helper function generates a string of a peers lastName and firstName
   * @param person
   * @returns
   */
  private formatName(person: any): string {
    return `${this.sanService.sanitize(
      person.lastName,
    )} ${this.sanService.sanitize(person.firstName)}`;
  }

  /**
   * this helper function determines if a groups gradings are complete
   * @param group
   * @param campaign
   * @returns
   */
  private gradingsComplete(group: Group, campaign: Campaign): boolean {
    return (
      group.gradings.length ===
      group.peers.length * group.peers.length * campaign.criteria.length
    );
  }

  /**
   * this helper function returns the percentage of a groups grading completenes. rounded to two digits.
   * @param group
   * @param campaign
   * @returns
   */
  private getGroupCompletenes(group: Group, campaign: Campaign): number {
    return (
      Math.round(
        (10000 /
          (group.peers.length *
            group.peers.length *
            campaign.criteria.length)) *
          group.gradings.length,
      ) / 100
    );
  }

  /**
   * returns a date formatted to the CET timezone
   * @param date
   * @returns
   */
  private formatDate(date: Date, lang: string): string {
    return date.toLocaleDateString(lang, {
      timeZone: 'Europe/Zurich',
    });
  }
}
