import { Injectable } from '@angular/core';
import { UserService } from './user.service';
import { Campaign, Grading, MailsSent, PeerComment } from '../interfaces';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

/**
 * this service handles most of the data transactions between frontend and backend
 */
@Injectable({
  providedIn: 'root',
})
export class PGTService {
  constructor(private http: HttpClient, private userService: UserService) {}

  deleteCampaign(campaign: Campaign) {
    return this.http.delete<Campaign>(
      environment.api + '/campaign/' + campaign.campaignId
    );
  }

  /**
   * this function updates a campaign
   * @param campaign
   * @returns
   */
  updateCampaign(campaign: Campaign) {
    return this.http.post<Campaign>(
      environment.api + '/campaign/update',
      campaign
    );
  }

  /**
   * this function creates a campaign
   * @param campaign
   * @returns
   */
  createCampaign(campaign: Campaign) {
    console.log('createing campaign', campaign);
    return this.http.post<Campaign>(
      environment.api + '/campaign/create',
      campaign
    );
  }

  getCampaignsByUser() {
    return this.http.get<Campaign[]>(environment.api + '/campaign/user');
  }

  getCampaignById(campaignId: number) {
    return this.http.get<Campaign>(environment.api + '/campaign/' + campaignId);
  }

  startCampaign(campaignId: number): Observable<MailsSent> {
    return this.http.get<MailsSent>(
      environment.api + '/campaign/start/' + campaignId
    );
  }

  endCampaign(campaignId: number): Observable<any> {
    return this.http.get<any>(environment.api + '/campaign/end/' + campaignId);
  }

  sendCampaignResults(campaignId: number): Observable<MailsSent> {
    return this.http.get<MailsSent>(
      environment.api + '/campaign/results/' + campaignId
    );
  }

  sendReminderMails(campaignId: number): Observable<MailsSent> {
    return this.http.get<MailsSent>(
      environment.api + '/campaign/reminder-mails/' + campaignId
    );
  }

  addGradingsAndComment(
    url: string,
    data: {
      gradings: Grading[];
      comments: any;
      groupId: number;
    },
  ) {
    return this.http.post(environment.api + '/group/' + url, data, {
      headers: {
        skipAuth: 'true',
      },
    });
  }

  getGroupByLink(url: string) {
    return this.http.get<any>(environment.api + '/group/' + url, {
      headers: {
        skipAuth: 'true',
      },
    });
  }

  /**
   * used to get all data in a single group by the url ending
   * @param url
   * @returns
   */
  getGroupForReview(url: string) {
    return this.http.get<any>(environment.api + '/group/review/' + url, {
      headers: {
        skipAuth: 'true',
      },
    });
  }

  /**
   * uses the url ending to get the specific pdf for a peer
   * @param url
   * @returns
   */
  getReviewPDF(url: string): Observable<Blob> {
    return this.http.get<Blob>(environment.api + '/pdf/review/' + url, {
      responseType: 'blob',
      headers: {
        skipAuth: 'true',
      },
    } as Record<string, unknown>);
  }

  /**
   * uses the url ending to get the specific pdf for a campaign
   * @param campaignId
   * @returns
   */
  getCampaignSummaryPDF(campaignId: number): Observable<Blob> {
    return this.http.get<Blob>(
      environment.api + '/pdf/campaign/' + campaignId,
      {
        responseType: 'blob',
      } as Record<string, unknown>
    );
  }

  /**
   * uses the url ending to get the specific excel for a campaign
   * @param campaignId
   * @returns
   */
  getCampaignSummaryExcel(campaignId: number): any {
    return this.http.get(environment.api + '/excel/' + campaignId, {
      responseType: 'arraybuffer',
    });
  }
}
