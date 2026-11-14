import { Component, OnInit, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { PGTService } from '../services/pgt.service';
import {
  DEFAULT_THRESHOLDS,
  Distribution,
  FindingType,
  RawCampaign,
  StatisticsService,
} from '../services/statistics.service';

/**
 * "Statistik" page: overview, response rate, distribution of the points and
 * notable results for the campaigns of the logged in lecturer.
 */
@Component({
    selector: 'pgt-statistics',
    templateUrl: './statistics.component.html',
    styleUrls: ['./statistics.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class StatisticsComponent implements OnInit {
  campaigns = signal<RawCampaign[]>([]);
  loading = signal(true);
  loadError = signal(false);

  /** 0 = all campaigns, otherwise a campaignId */
  selectedCampaignId = signal(0);
  deviationThreshold = signal(DEFAULT_THRESHOLDS.deviation);
  spreadThreshold = signal(DEFAULT_THRESHOLDS.spread);

  selectedCampaigns = computed(() => {
    const id = this.selectedCampaignId();
    return id === 0
      ? this.campaigns()
      : this.campaigns().filter((c) => c.campaignId === id);
  });

  /** one campaign selected: response rate per group instead of per campaign */
  perGroup = computed(() => this.selectedCampaignId() !== 0);

  stats = computed(() =>
    this.statisticsService.calculate(
      this.selectedCampaigns(),
      {
        deviation: this.deviationThreshold(),
        spread: this.spreadThreshold(),
      },
      this.perGroup()
    )
  );

  readonly swissLabel = $localize`Notenskala 1–6`;

  readonly findingLabels: Record<FindingType, string> = {
    selfHigher: $localize`Selbstbild höher als Fremdbild`,
    selfLower: $localize`Selbstbild tiefer als Fremdbild`,
    aboveGroup: $localize`Deutlich über dem Gruppenschnitt`,
    belowGroup: $localize`Deutlich unter dem Gruppenschnitt`,
    sameForAll: $localize`Gibt allen dieselbe Punktzahl`,
    raterSpread: $localize`Bewertungen gehen weit auseinander`,
  };

  readonly findingHints: Record<FindingType, string> = {
    selfHigher: $localize`Selbstbewertung minus Fremdbewertung`,
    selfLower: $localize`Selbstbewertung minus Fremdbewertung`,
    aboveGroup: $localize`Fremdbewertung minus Gruppenschnitt`,
    belowGroup: $localize`Fremdbewertung minus Gruppenschnitt`,
    sameForAll: $localize`vergebene Punktzahl`,
    raterSpread: $localize`Differenz zwischen grosszügigster und strengster Bewertung`,
  };

  constructor(
    private pgtService: PGTService,
    private statisticsService: StatisticsService
  ) {}

  ngOnInit(): void {
    this.pgtService.getCampaignsByUser().subscribe({
      next: (campaigns) => {
        this.campaigns.set(campaigns as unknown as RawCampaign[]);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  onCampaignChange(value: string) {
    this.selectedCampaignId.set(Number(value));
  }

  onThreshold(target: 'deviation' | 'spread', value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    (target === 'deviation' ? this.deviationThreshold : this.spreadThreshold).set(n);
  }

  // ---- helpers for the SVG bar chart ----

  // all charts have the same size; the bars share the width
  readonly chartWidth = 440;
  readonly chartHeight = 180;

  private slot(n: number): number {
    return this.chartWidth / Math.max(n, 1);
  }

  barWidth(n: number): number {
    return this.slot(n) * 0.7;
  }

  barX(n: number, i: number): number {
    return i * this.slot(n) + this.slot(n) * 0.15;
  }

  barCenter(n: number, i: number): number {
    return i * this.slot(n) + this.slot(n) / 2;
  }

  barHeight(d: Distribution, count: number): number {
    const max = Math.max(...d.steps.map((s) => s.count), 1);
    return (count / max) * (this.chartHeight - 42);
  }

  devBarHeight(steps: { count: number }[], count: number): number {
    const max = Math.max(...steps.map((s) => s.count), 1);
    return (count / max) * (this.chartHeight - 42);
  }

  percent(d: Distribution, count: number): number {
    return d.total ? Math.round((100 * count) / d.total) : 0;
  }

  /** deviations with sign, max. 2 decimals: +1.5, -0.25, 0 */
  signed(value: number): string {
    return (value > 0 ? '+' : '') + String(Number(value.toFixed(2)));
  }

  stepLabel(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }
}
