import { Injectable, WritableSignal, signal, inject } from '@angular/core';
import { Campaign } from '../interfaces';
import { PGTService } from '../services/pgt.service';
import { CampaignService } from '../services/campaign.service';
import { SnackBarService } from '../services/snack-bar.service';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AdminDashboardService {
  private pgtService = inject(PGTService);
  private campaignService = inject(CampaignService);
  private snackBarService = inject(SnackBarService);
  private router = inject(Router);

  campaigns: WritableSignal<Campaign[]> = signal([]);

  reloadCampaigns() {
    this.pgtService.getCampaignsByUser().subscribe({
      next: (campaigns: Campaign[]) => {
        let cleanCampaigns = [];
        for (const campaign of campaigns) {
          cleanCampaigns.push(
            this.campaignService.cleanupCampaignData(campaign)
          );
        }
        // the campaigns are sorted by creation date descending
        cleanCampaigns.reverse();
        cleanCampaigns = cleanCampaigns.sort(
          (campaignA, campaignB) =>
            campaignB.creationDate.getTime() - campaignA.creationDate.getTime()
        );

        this.campaigns.set(cleanCampaigns);
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        this.router.navigate(['/login']);
      },
    });
  }
}
