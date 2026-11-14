import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WarnDialogComponent } from '../warn-dialog/warn-dialog.component';
import { SuperService } from '../services/super.service';
import { SnackBarService } from '../services/snack-bar.service';
import { Campaign, CampaignStatus, User } from '../interfaces';
import { CampaignService } from '../services/campaign.service';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { CampaignMetaComponent } from '../campaign-meta/campaign-meta.component';
import { UpperCasePipe, DatePipe } from '@angular/common';
import { CampaignStatusPipe } from '../pipes/campaign-status.pipe';
/**
 * this component is only accessible for super users
 * there you get a list of all admin users and can edit or delete them
 */
@Component({
    selector: 'pgt-user-list',
    templateUrl: './admin-user-list.component.html',
    styleUrls: ['./admin-user-list.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatIcon, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, CampaignMetaComponent, UpperCasePipe, DatePipe, CampaignStatusPipe]
})
export class AdminUserListComponent implements OnInit {
  private adminService = inject(SuperService);
  private router = inject(Router);
  private snackBarService = inject(SnackBarService);
  dialog = inject(MatDialog);
  private campaignService = inject(CampaignService);

  admins: User[];

  /**
   * gets all admins from the backend through adminService
   */
  ngOnInit(): void {
    const adminList = this.adminService.getAdmins().subscribe({
      next: (admins) => {
        // formatting campaigns
        for (const admin of admins) {
          if (admin.campaigns) {
            admin.campaigns = admin.campaigns.map((campaign: Campaign) =>
              this.campaignService.cleanupCampaignData(campaign)
            );
          }
        }

        this.admins = admins;
        adminList.unsubscribe();
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        this.router.navigate(['/admin-dashboard']);
      },
    });
  }

  navigate(url: string) {
    this.router.navigate([url]);
  }

  /**
   * the super user is prompted before deleting the super user
   * @param admin
   */
  delete(admin: User) {
    const dialogRef = this.dialog.open(WarnDialogComponent, {
      data: {
        text: $localize`Möchten Sie den Admin ${admin.firstName} ${admin.lastName} wirklich löschen?`,
      },
    });
    dialogRef.afterClosed().subscribe((shouldDelete: boolean) => {
      if (shouldDelete) {
        const deletion = this.adminService
          .deleteAdmin({ email: admin.email })
          .subscribe({
            next: () => {
              deletion.unsubscribe();
              this.ngOnInit();
              this.snackBarService.openSnackBar(
                $localize`Admin ${admin.firstName} ${admin.lastName} wurde gelöscht.`
              );
            },
            error: (err) => {
              this.snackBarService.openErrorBar(err);
            },
          });
      }
    });
  }

  edit(admin: User) {
    this.router.navigate(['/create-user/' + admin.userId]);
  }

  getCampaignStatus(campaign: Campaign): CampaignStatus {
    return this.campaignService.getCampaignStatus(campaign);
  }
}
