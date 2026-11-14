import { Component, DestroyRef, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
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
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink, RouterLinkActive, LanguageSwitchComponent]
})
export class HeaderComponent implements OnInit {
  router = inject(Router);
  userService = inject(UserService);
  tokenService = inject(TokenService);
  private authService = inject(AuthService);
  private pgtService = inject(PGTService);

  user: User | null = null;
  campaignCount: number | null = null;
  participantCount = 0;

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
      .subscribe(() => this.refresh());
  }

  get isAdmin(): boolean {
    return !!this.user?.roles.includes(UserRole.ADMIN);
  }

  /** pages for peers (opened via their personal link) and the login pages */
  get isPublicPage(): boolean {
    const url = this.router.url;
    return (
      url.includes('/peer-grading') ||
      url.includes('/login') ||
      url.includes('/register') ||
      url.includes('/auth/callback')
    );
  }

  /** the title leads back to the start page */
  get homeLink(): string {
    return this.isAdmin ? '/admin-dashboard' : '/login';
  }

  private refresh() {
    // only ask the backend if there is a session, otherwise peers
    // (who have no login) would be sent to the login page
    if (!this.tokenService.hasToken()) {
      this.user = null;
      this.campaignCount = null;
      return;
    }

    this.userService.getUser().subscribe({
      next: (user: User) => {
        this.user = user;
        if (this.isAdmin) this.loadMetrics();
      },
      error: () => (this.user = null),
    });
  }

  /** live metrics for the third header line */
  private loadMetrics() {
    this.pgtService.getCampaignsByUser().subscribe({
      next: (campaigns: Campaign[]) => {
        this.campaignCount = campaigns.length;
        this.participantCount = campaigns.reduce(
          (sum, c) =>
            sum + c.groups.reduce((s, g) => s + (g.peers?.length ?? 0), 0),
          0
        );
      },
      error: () => (this.campaignCount = null),
    });
  }

  logout() {
    this.authService.logout();
    this.user = null;
    this.campaignCount = null;
  }
}
