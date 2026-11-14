import { Component, OnInit, Signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { Campaign } from '../interfaces';
import { UserService } from '../services/user.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { CampaignComponent } from './campaign/campaign.component';
/**
 * this component is the first screen you see after login.
 * you get the exisisting campaigns and can edit or see details of them.
 * you can create a new campaign too.
 */
@Component({
    selector: 'pgt-admin-dashboard',
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButton, MatIcon, CampaignComponent]
})
export class AdminDashboardComponent implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);
  private adminDashboardService = inject(AdminDashboardService);

  // a behavior subject that stores all the campaigns of the user
  campaigns: Signal<Campaign[]> = this.adminDashboardService.campaigns;

  /**
   * upon initialization, it gets the all the campaigns of the user, that just logged in.
   */
  ngOnInit(): void {
    this.userService
      .getUser()
      .pipe(take(1))
      .subscribe(() => {
        this.adminDashboardService.reloadCampaigns();
      });
  }

  onReloadEvent(_event: any) {
    this.adminDashboardService.reloadCampaigns();
  }

  createCampaign() {
    this.router.navigate(['/create-campaign/']);
  }
}
