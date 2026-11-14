import { Component, OnInit, Signal, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PGTService } from '../services/pgt.service';
import { SnackBarService } from '../services/snack-bar.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
    selector: 'pgt-excel',
    templateUrl: './excel.component.html',
    styleUrls: ['./excel.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExcelComponent implements OnInit {
  private pgtService = inject(PGTService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBarService = inject(SnackBarService);

  campaignId: Signal<number> = signal(
    this.activatedRoute.snapshot.params['id']
  );

  ngOnInit(): void {
    this.pgtService.getCampaignSummaryExcel(this.campaignId()).subscribe({
      next: (res: any) => {
        const blob = new Blob([res]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.setAttribute('style', 'display: none');
        a.href = url;
        a.download = $localize`Kampagnenuebersicht.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openErrorBar(error);
        this.router.navigate(['/admin-dashboard']);
      },
    });
  }
}
