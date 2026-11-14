import { Component, OnInit, Signal, WritableSignal, computed, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Campaign, Group, Peer, PeerComment } from '../interfaces';
import { CampaignService } from '../services/campaign.service';
import { PGTService } from '../services/pgt.service';
import { SnackBarService } from '../services/snack-bar.service';
import { HttpErrorResponse } from '@angular/common/http';
import { GroupMetaComponent } from '../group-meta/group-meta.component';
import { ToolTipComponent } from '../tool-tip/tool-tip.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { DatePipe } from '@angular/common';

interface GradingReviewData {
  campaign: Campaign;
  group: Group;
  peer: Peer;
  selfAverage: number;
  thirdPartyAverage: number;
  /** final grade, rounded like set in the campaign */
  grade: number;
  gradeRounding: number;
  thirdPartyAverages: any;
  selfGradings: any;
  groupAverage: number;
  difference: number;
  comments: PeerComment[];
}

/**
 * this component displays the peer grading review for a peer user
 */
@Component({
    selector: 'pgt-grading-review',
    templateUrl: './grading-review.component.html',
    styleUrls: ['../app.component.css', './grading-review.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [GroupMetaComponent, ToolTipComponent, MatButton, MatIcon, DatePipe]
})
export class PeerGradingReviewComponent implements OnInit {
  pgtService = inject(PGTService);
  campaignService = inject(CampaignService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBarService = inject(SnackBarService);

  url: Signal<string> = signal(this.activatedRoute.snapshot.params['url']);

  gradingReviewData: WritableSignal<GradingReviewData> = signal({
    campaign: this.campaignService.campaignConstructor('', 0, 'de'),
    group: this.campaignService.groupConstructor(),
    peer: this.campaignService.peerConstructor('', '', ''),
    selfAverage: 0,
    selfGradings: {},
    thirdPartyAverage: 0,
    grade: 0,
    gradeRounding: 0.5,
    thirdPartyAverages: {},
    groupAverage: 0,
    difference: 0,
    comments: [],
  });
  campaign: Signal<Campaign> = computed(() =>
    this.campaignService.cleanupCampaignData(this.gradingReviewData().campaign)
  );
  peer: Signal<Peer> = computed(() => this.gradingReviewData().peer);
  group: Signal<Group> = computed(() => this.gradingReviewData().group);

  today: Date = new Date();

  /**
   * when the component is initialized, it uses the url to get the data from the backend
   */
  ngOnInit(): void {
    this.pgtService.getGroupForReview(this.url()).subscribe({
      next: (data: GradingReviewData) => {
        this.gradingReviewData.set(data);
      },
      error: (err) => {
        this.router.navigate([`/error/${err.status}`]);
      },
    });
  }

  /**
   * this function is called when the export button in html is clicked
   */
  exportPDF() {
    this.pgtService.getReviewPDF(this.url()).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.setAttribute('style', 'display: none');
        a.href = url;
        if (this.campaign()) {
          a.download = `PeerReview_${this.peer().lastName}_${
            this.peer().firstName
          }_${new Date().toLocaleDateString()}.pdf`;
        }
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openSnackBar(
          $localize`Review konnte nicht exportiert werden.` +
            ` ` +
            $localize`Fehlermeldung: ${error.message}`
        );
      },
    });
  }
}
