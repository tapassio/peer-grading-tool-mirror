import { Pipe, PipeTransform } from '@angular/core';
import { CampaignStatus } from '../interfaces';

@Pipe({ name: 'campaignStatus', })
export class CampaignStatusPipe implements PipeTransform {
  transform(status: CampaignStatus): string {
    switch (status) {
      case 'erstellt':
        return $localize`erstellt`;
      case 'läuft':
        return $localize`läuft`;
      case 'abgeschlossen':
        return $localize`abgeschlossen`;
      default:
        return status;
    }
  }
}
