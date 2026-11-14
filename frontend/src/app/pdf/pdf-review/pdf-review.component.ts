import { Component, OnInit, Signal, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PGTService } from '../../services/pgt.service';
/**
 * this page is loaded only when a link to get a peer grading review is opened
 * the pdf is generated in the backend and immediately downloaded
 */
@Component({
    selector: 'pgt-pdf-review',
    templateUrl: './pdf-review.component.html',
    styleUrls: ['./pdf-review.component.css', '../../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager
})
export class PdfReviewComponent implements OnInit {
  private pgtService = inject(PGTService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  url: Signal<string> = signal(this.activatedRoute.snapshot.params['url']);

  ngOnInit(): void {
    this.pgtService.getReviewPDF(this.url()).subscribe({
      next: (blob) => {
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.setAttribute('style', 'display: none');
          a.href = url;
          a.download = $localize`Review.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        }
      },
      error: (err) => {
        this.router.navigate([`/error/${err.status}`]);
      },
    });
  }
}
