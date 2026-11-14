import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, Campaign, UserRole, RegisterData } from '../interfaces';
import { SnackBarService } from './snack-bar.service';
import { CampaignService } from './campaign.service';
import { TokenService } from './token.service';
import { Router } from '@angular/router';

/**
 * this service handles data transactions regarding users
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private http: HttpClient,
    private tokenService: TokenService,
    private snackBarService: SnackBarService,
    private router: Router,
    private campaignService: CampaignService
  ) {}

  /**
   * this functions sets a users password
   * @param data
   * @returns
   */
  changeUserPW(data: any) {
    return this.http.post(environment.api + '/user/admin/pw', data);
  }

  getUser(): Observable<User> {
    return this.http
      .get(environment.api + '/auth/profile')
      .pipe(map((user: any) => this.cleanupUserData(user)));
  }

  login(data: any, returnUrl?: string) {
    const targetUrl = returnUrl ?? '/admin-dashboard';
    data.email = data.email.trim();
    return this.http
      .post(environment.api + '/auth/login', data)
      .pipe(
        switchMap((tokens: any) => {
          // the refresh token comes as HttpOnly cookie
          this.tokenService.setAccessToken(tokens.accessToken);
          return this.getUser();
        })
      )
      .subscribe({
        next: (user: User) => {
          // get return url from query parameters or default to home page
          if (user.roles.includes(UserRole.ADMIN)) {
            this.router.navigateByUrl(targetUrl);
          } else {
            this.snackBarService.openSnackBar(
              $localize`Zugriff nur für Administratoren gestattet`
            );
          }
          return;
        },
        error: () => {
          this.snackBarService.openSnackBar(
            $localize`Username oder Passwort falsch`
          );
        },
      });
  }

  logout() {
    this.http
      .post(environment.api + '/auth/logout', this.tokenService.getToken())
      .subscribe()
      .add(() => {
        this.tokenService.signOut();
        this.router.navigate(['./login']);
      });
  }

  cleanupUserData(user: User): User {
    const { roles, campaigns, ...rest } = user;
    const cleanRoles: any[] = [];
    for (const role of user.roles) {
      cleanRoles.push(UserRole[role]);
    }
    const cleanCampaigns: Campaign[] = [];
    if (user.campaigns) {
      for (const campaign of user.campaigns) {
        cleanCampaigns.push(this.campaignService.cleanupCampaignData(campaign));
      }
    }
    return {
      ...rest,
      roles: cleanRoles,
      campaigns: cleanCampaigns,
    };
  }

  register(registerData: RegisterData) {
    registerData.email = registerData.email.trim();
    registerData.emailRepeat = registerData.emailRepeat.trim();
    registerData.company = registerData.company?.trim();

    return this.http.post(environment.api + '/auth/register', registerData);
  }

  confirmEmail(registerToken: string) {
    return this.http.post(environment.api + '/auth/confirm-email', {
      registerToken: registerToken,
    });
  }

  /**
   * this function is used in the header component to get a string of all the users roles
   * @param user
   * @returns
   */
  userRolesToString(user: User) {
    const result: string[] = [];
    for (const role of user.roles) {
      if (role == 0) {
        result.push($localize`Admin`);
      } else if (role == 2) {
        result.push($localize`Super User*in`);
      } else {
        result.push($localize`Teilnehmer*in`);
      }
    }
    return result;
  }
}
