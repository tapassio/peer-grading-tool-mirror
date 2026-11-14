import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ObjectSchema } from 'joi';
import { createCampaignSchema } from './joi-objects';

@Injectable()
export class CampaignValidationPipe implements PipeTransform {
  isCreate: boolean;
  campaign: any;
  schema: ObjectSchema;

  constructor(campaign: any, isCreate: boolean) {
    this.isCreate = isCreate;
    this.campaign = campaign;
    this.schema = createCampaignSchema(campaign.maxPoints);
  }

  transform(campaign: any, _metadata: ArgumentMetadata) {
    const validation = this.schema.validate(campaign);
    if (validation.error) {
      console.log('validation error', validation.error);
      throw new BadRequestException('Validation failed');
    }

    /// cecking for errors in campaign data
    const campaignErrors = this.getCampaignErrors(campaign);

    if (campaignErrors.length > 0)
      throw new BadRequestException(
        campaignErrors.join(' '),
        'Bad Campaign Data',
      );

    return campaign;
  }

  /**
   * this method checks if the data of the campaign makes sense and returns the errors as an array of strings
   */
  private getCampaignErrors(campaign: any) {
    const campaignErrors = [];

    if (!Number.isInteger(campaign.maxPoints)) {
      campaignErrors.push('Maximale Punktzahl muss eine Ganzzahl sein.');
    }

    if (campaign.criteria.length == 0) {
      campaignErrors.push('Keine Kriterien erfasst.');
    }

    if (campaign.groups.length == 0) {
      campaignErrors.push('Keine Gruppen erfasst.');
    }

    for (const group of campaign.groups) {
      if (group.peers.length == 0) {
        campaignErrors.push(`Keine Teilnehmenden in Gruppe ${group.number}.`);
      }
    }

    return campaignErrors;
  }

  /**
   * this function is used solely to prepare the opening date before sending it to the backend
   * @param inputDate comes in with arbitrary time
   * @param hour target hour
   * @param minute target minute
   * @param second target second
   * @returns the target
   */
  private calculateDate(
    inputDate: string,
    hour: number,
    minute: number,
    second: number,
  ): Date {
    const outputDate = new Date(inputDate);

    // the offset is the hours that the CET is off by UTC (daylight saving time taken into account)
    const offset = parseInt(
      outputDate
        .toLocaleDateString('de-CH', {
          timeZone: 'Europe/Zurich',
          timeZoneName: 'shortOffset',
        })
        .split(' ')[1]
        .substring(3),
    );

    const date = outputDate.getDate();
    const month = outputDate.getMonth();

    outputDate.setUTCDate(date);
    outputDate.setUTCMonth(month);
    outputDate.setUTCHours(hour - offset, minute, second, 0);

    return outputDate;
  }
}
