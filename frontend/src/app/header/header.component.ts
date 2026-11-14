import { Component, DestroyRef, OnInit, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { Campaign, User, UserRole } from '../interfaces';
import { TokenService } from '../services/token.service';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { PGTService } from '../services/pgt.service';
import { LanguageSwitchComponent } from '../language-switch/language-switch.component';

/**
 * Header in the style of the Toolchain Family tools:
 * 1. dark title bar (icon + title, tagline, live metrics)
 * 2. grey menu bar (navigation left; dashboard, language, help, user right)
 *
 * It is shown on every page (except the PDF downloads), so it reloads the
 * user after every navigation (e.g. after login or logout).
 */
@Component({
    selector: 'pgt-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, RouterLinkActive, LanguageSwitchComponent]
})
export class HeaderComponent implements OnInit {
  router = inject(Router);
  userService = inject(UserService);
  tokenService = inject(TokenService);
  private authService = inject(AuthService);
  private pgtService = inject(PGTService);

  // signals: the header uses OnPush and redraws when one of them changes
  readonly user = signal<User | null>(null);
  readonly campaignCount = signal<number | null>(null);
  readonly participantCount = signal(0);
  /** current URL, updated after every navigation */
  private readonly url = signal(this.router.url);

  readonly isAdmin = computed(
    () => !!this.user()?.roles.includes(UserRole.ADMIN)
  );

  /** pages for peers (opened via their personal link) and the login pages */
  readonly isPublicPage = computed(() => {
    const url = this.url();
    return (
      url.includes('/peer-grading') ||
      url.includes('/login') ||
      url.includes('/register') ||
      url.includes('/auth/callback')
    );
  });

  /** the title leads back to the start page */
  readonly homeLink = computed(() =>
    this.isAdmin() ? '/admin-dashboard' : '/login'
  );

  UserRole = UserRole;
  toolchainUrl = environment.toolchainUrl;

  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.refresh();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.url.set(this.router.url);
        this.refresh();
      });
  }

  private refresh() {
    // only ask the backend if there is a session, otherwise peers
    // (who have no login) would be sent to the login page
    if (!this.tokenService.hasToken()) {
      this.user.set(null);
      this.campaignCount.set(null);
      return;
    }

    this.userService.getUser().subscribe({
      next: (user: User) => {
        this.user.set(user);
        if (this.isAdmin()) this.loadMetrics();
      },
      error: () => this.user.set(null),
    });
  }

  /** live metrics for the third header line */
  private loadMetrics() {
    this.pgtService.getCampaignsByUser().subscribe({
      next: (campaigns: Campaign[]) => {
        this.campaignCount.set(campaigns.length);
        this.participantCount.set(
          campaigns.reduce(
            (sum, c) =>
              sum + c.groups.reduce((s, g) => s + (g.peers?.length ?? 0), 0),
            0
          )
        );
      },
      error: () => this.campaignCount.set(null),
    });
  }

  logout() {
    this.authService.logout();
    this.user.set(null);
    this.campaignCount.set(null);
  }
}
