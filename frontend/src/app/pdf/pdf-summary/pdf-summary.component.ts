import { Component, OnInit, Signal, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PGTService } from '../../services/pgt.service';
import { SnackBarService } from '../../services/snack-bar.service';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * these page is loaded only when a link to get a campaign summary is opened
 * the pdf is generated in the backend and immediately downloaded
 */
@Component({
    selector: 'pgt-pdf-summary',
    templateUrl: './pdf-summary.component.html',
    styleUrls: ['./pdf-summary.component.css', '../../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PdfSummaryComponent implements OnInit {
  campaignId: Signal<number> = signal(
    this.activatedRoute.snapshot.params['id']
  );

  constructor(
    private pgtService: PGTService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private snackBarService: SnackBarService
  ) {}

  ngOnInit(): void {
    this.pgtService.getCampaignSummaryPDF(this.campaignId()).subscribe({
      next: (blob) => {
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.setAttribute('style', 'display: none');
          a.href = url;
          a.download = $localize`Kampagnenuebersicht.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        this.router.navigate(['/admin-dashboard']);
      },
    });
  }
}
