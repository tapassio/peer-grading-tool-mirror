import { Component, OnInit, Signal, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PGTService } from '../services/pgt.service';
import { SnackBarService } from '../services/snack-bar.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
    selector: 'pgt-excel',
    templateUrl: './excel.component.html',
    styleUrls: ['./excel.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExcelComponent implements OnInit {
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
    this.pgtService.getCampaignSummaryExcel(this.campaignId()).subscribe({
      next: (res: any) => {
        const blob = new Blob([res]);
        let url = window.URL.createObjectURL(blob);
        let a = document.createElement('a');
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
