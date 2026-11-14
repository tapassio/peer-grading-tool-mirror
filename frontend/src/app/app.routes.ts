import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { pendingChangesGuard } from './guards/pending-changes.guard';

/**
 * All pages are loaded lazily (loadComponent): the browser only downloads a
 * page when it is opened. This keeps the first download small, e.g. the PDF
 * and statistics code is not needed for the login page or a peer link.
 */
export const routes: Routes = [
  {
    path: 'admin-dashboard',
    loadComponent: () =>
      import('./admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'statistics',
    loadComponent: () =>
      import('./statistics/statistics.component').then((m) => m.StatisticsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'create-campaign',
    loadComponent: () =>
      import('./create-campaign/create-campaign.component').then((m) => m.CreateCampaignComponent),
    canActivate: [authGuard],
    canDeactivate: [pendingChangesGuard],
  },
  {
    path: 'create-campaign/:id',
    loadComponent: () =>
      import('./create-campaign/create-campaign.component').then((m) => m.CreateCampaignComponent),
    canActivate: [authGuard],
    canDeactivate: [pendingChangesGuard],
  },
  {
    path: 'campaign-summary/:id',
    loadComponent: () =>
      import('./campaign-summary/campaign-summary.component').then((m) => m.CampaignSummaryComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
  },
  {
    path: 'user-list',
    loadComponent: () =>
      import('./admin-user-list/admin-user-list.component').then((m) => m.AdminUserListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'create-user',
    loadComponent: () =>
      import('./create-admin-user/create-admin-user.component').then((m) => m.CreateAdminUserComponent),
    canActivate: [authGuard],
  },
  {
    path: 'create-user/:id',
    loadComponent: () =>
      import('./create-admin-user/create-admin-user.component').then((m) => m.CreateAdminUserComponent),
    canActivate: [authGuard],
  },
  // Intentionally PUBLIC: peers never log in. The random 256-bit link (see
  // backend AppService.generateLink) is the only credential, so these two
  // routes must stay free of authGuard.
  {
    path: 'peer-grading/:url',
    loadComponent: () =>
      import('./grading/grading.component').then((m) => m.GradingComponent),
  },
  {
    path: 'peer-grading-review/:url',
    loadComponent: () =>
      import('./grading-review/grading-review.component').then((m) => m.PeerGradingReviewComponent),
  },
  {
    path: 'pdf/summary/:id',
    loadComponent: () =>
      import('./pdf/pdf-summary/pdf-summary.component').then((m) => m.PdfSummaryComponent),
    canActivate: [authGuard],
  },
  {
    path: 'pdf/review/:url',
    loadComponent: () =>
      import('./pdf/pdf-review/pdf-review.component').then((m) => m.PdfReviewComponent),
  },
  {
    path: 'excel/:id',
    loadComponent: () =>
      import('./excel/excel.component').then((m) => m.ExcelComponent),
    canActivate: [authGuard],
  },
  {
    path: 'error/:id',
    loadComponent: () =>
      import('./http-error/http-error.component').then((m) => m.HttpErrorComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'register/:token',
    loadComponent: () =>
      import('./confirm-email/confirm-email.component').then((m) => m.ConfirmEmailComponent),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./about/about.component').then((m) => m.AboutComponent),
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/error/404', pathMatch: 'full' },
];
