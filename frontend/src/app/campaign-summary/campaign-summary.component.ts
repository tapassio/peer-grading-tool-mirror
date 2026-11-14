import { Component, OnInit, WritableSignal, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Campaign } from '../interfaces';
import { PGTService } from '../services/pgt.service';
import { SnackBarService } from '../services/snack-bar.service';
import { CampaignService } from '../services/campaign.service';
import { ToolchainService } from '../services/toolchain.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CampaignComponent } from '../admin-dashboard/campaign/campaign.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { CampaignGroupSummaryComponent } from './campaign-group-summary/campaign-group-summary.component';

/**
 * this component displays all data of a single campaign. only accessible for admin users
 * it has a child component to display each individual group in the campaign
 */
@Component({
    selector: 'pgt-campaign-summary',
    templateUrl: './campaign-summary.component.html',
    styleUrls: ['./campaign-summary.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CampaignComponent, MatButton, MatIcon, CampaignGroupSummaryComponent]
})
export class CampaignSummaryComponent implements OnInit {
  pgtService = inject(PGTService);
  private activatedRoute = inject(ActivatedRoute);
  private snackBarService = inject(SnackBarService);
  private router = inject(Router);
  private campaignService = inject(CampaignService);
  private toolchainService = inject(ToolchainService);

  campaignId: WritableSignal<number> = signal(
    this.activatedRoute.snapshot.params['id']
  );
  campaign: WritableSignal<Campaign | undefined> = signal(undefined);
  publishing: WritableSignal<boolean> = signal(false);
  published: WritableSignal<boolean> = signal(false);

  get canPublish(): boolean {
    return this.toolchainService.canPublish();
  }

  /**
   * Publishes the aggregated, anonymised results as a private DocPouch
   * document (visible only to administrators).
   */
  async publishToToolchain() {
    const campaign = this.campaign();
    if (!campaign || this.publishing()) {
      return;
    }

    this.publishing.set(true);
    try {
      await this.toolchainService.publishCampaign(campaign);
      this.published.set(true);
      this.snackBarService.openSnackBar(
        $localize`Ergebnisse wurden in der Toolchain veröffentlicht.`
      );
    } catch {
      this.snackBarService.openSnackBar(
        $localize`Veröffentlichung in der Toolchain fehlgeschlagen.`
      );
    } finally {
      this.publishing.set(false);
    }
  }

  ngOnInit(): void {
    this.pgtService.getCampaignById(this.campaignId()).subscribe({
      next: (campaign) => {
        // cleaning up campaigndata
        this.campaign.set(this.campaignService.cleanupCampaignData(campaign));
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        this.router.navigate(['/admin-dashboard']);
      },
    });
  }

  onReloadEvent(value: string) {
    if (value == 'delete') {
      this.router.navigate(['/admin-dashboard']);
      return;
    }

    this.ngOnInit();
  }
}
