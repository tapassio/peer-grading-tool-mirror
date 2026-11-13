import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from './about/about.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { ProfileComponent } from './profile/profile.component';
import { CampaignSummaryComponent } from './campaign-summary/campaign-summary.component';
import { CreateCampaignComponent } from './create-campaign/create-campaign.component';
import { CreateAdminUserComponent } from './create-admin-user/create-admin-user.component';
import { GradingComponent } from './grading/grading.component';
import { LoginComponent } from './login/login.component';
import { PdfReviewComponent } from './pdf/pdf-review/pdf-review.component';
import { PdfSummaryComponent } from './pdf/pdf-summary/pdf-summary.component';
import { PeerGradingReviewComponent } from './grading-review/grading-review.component';
import { AdminUserListComponent } from './admin-user-list/admin-user-list.component';
import { ExcelComponent } from './excel/excel.component';
import { HttpErrorComponent } from './http-error/http-error.component';
import { authGuard } from './guards/auth.guard';
import { pendingChangesGuard } from './guards/pending-changes.guard';
import { RegisterComponent } from './register/register.component';
import { ConfirmEmailComponent } from './confirm-email/confirm-email.component';
import { AuthCallbackComponent } from './auth-callback/auth-callback.component';

const routes: Routes = [
  {
    path: 'admin-dashboard',
    component: AdminDashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'create-campaign',
    component: CreateCampaignComponent,
    canActivate: [authGuard],
    canDeactivate: [pendingChangesGuard],
  },
  {
    path: 'create-campaign/:id',
    component: CreateCampaignComponent,
    canActivate: [authGuard],
    canDeactivate: [pendingChangesGuard],
  },
  {
    path: 'campaign-summary/:id',
    component: CampaignSummaryComponent,
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
  },
  {
    path: 'user-list',
    component: AdminUserListComponent,
    canActivate: [authGuard],
  },
  {
    path: 'create-user',
    component: CreateAdminUserComponent,
    canActivate: [authGuard],
  },
  {
    path: 'create-user/:id',
    component: CreateAdminUserComponent,
    canActivate: [authGuard],
  },
  {
    path: 'peer-grading/:url',
    component: GradingComponent,
  },
  {
    path: 'peer-grading-review/:url',
    component: PeerGradingReviewComponent,
  },
  {
    path: 'pdf/summary/:id',
    component: PdfSummaryComponent,
    canActivate: [authGuard],
  },
  {
    path: 'pdf/review/:url',
    component: PdfReviewComponent,
  },
  {
    path: 'excel/:id',
    component: ExcelComponent,
    canActivate: [authGuard],
  },
  {
    path: 'error/:id',
    component: HttpErrorComponent,
  },
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'register/:token', component: ConfirmEmailComponent },
  { path: 'about', component: AboutComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/error/404', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
