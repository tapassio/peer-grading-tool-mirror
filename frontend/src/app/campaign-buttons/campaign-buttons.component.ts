import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, inject } from '@angular/core';
import { Campaign, CampaignStatus, MailsSent } from '../interfaces';
import { Router } from '@angular/router';
import { PGTService } from '../services/pgt.service';
import { SnackBarService } from '../services/snack-bar.service';
import { CampaignService } from '../services/campaign.service';
import { WarnDialogComponent } from '../warn-dialog/warn-dialog.component';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
    selector: 'pgt-campaign-buttons',
    templateUrl: './campaign-buttons.component.html',
    styleUrls: ['./campaign-buttons.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatIcon, MatTooltip]
})
export class CampaignButtonsComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private pgtService = inject(PGTService);
  private snackBarService = inject(SnackBarService);
  private campaignService = inject(CampaignService);

  @Input() campaign: Campaign;
  @Input() viewState: 'dashboard' | 'summary';
  @Output() reloadEvent: EventEmitter<string> = new EventEmitter<string>();

  edit() {
    this.router.navigate(['/create-campaign/' + this.campaign.campaignId]);
  }

  /**
   * before sending mails, the user is prompted to confirm.
   */
  startCampaign() {
    const dialogRef = this.dialog.open(WarnDialogComponent, {
      data: {
        text: $localize`Möchten Sie die Kampagne "${this.campaign.name}" wirklich beginnen und allen Teilnehmern die Einladungs-Mails zusenden?`,
        affirmButton: $localize`Senden`,
      },
    });

    dialogRef.afterClosed().subscribe((accepted: boolean) => {
      if (accepted)
        this.pgtService.startCampaign(this.campaign.campaignId).subscribe({
          next: (mailsSent: MailsSent) => {
            this.snackBarService.openSnackBar(
              $localize`Kampagne "${this.campaign.name}" erfolgreich begonnen.` +
                ' ' +
                $localize`Anzahl gesendete Mails: Teilnehmer: ${mailsSent.peerMailsSent}; Admins: ${mailsSent.adminMailsSent}.`
            );
            this.reloadEvent.emit('start');
          },
          error: (error: HttpErrorResponse) => {
            this.snackBarService.openSnackBar(
              $localize`Kampagne konnte nicht begonnen werden.` +
                ` ` +
                $localize`Fehlermeldung: ${error.message}`
            );
          },
        });
    });
  }

  /**
   * before sending mails, the user is prompted to confirm.
   */
  endCampaign() {
    const dialogRef = this.dialog.open(WarnDialogComponent, {
      data: {
        text: $localize`Möchten Sie die Kampagne "${this.campaign.name}" wirklich beenden? Ausstehende Gradings können nicht mehr eingetragen werden.`,
        affirmButton: $localize`Senden`,
      },
    });

    dialogRef.afterClosed().subscribe((accepted: boolean) => {
      if (accepted)
        this.pgtService.endCampaign(this.campaign.campaignId).subscribe({
          next: () => {
            this.snackBarService.openSnackBar(
              $localize`Kampagne "${this.campaign.name}" erfolgreich beendet.`
            );
            this.reloadEvent.emit('end');
          },
          error: (error: HttpErrorResponse) => {
            this.snackBarService.openSnackBar(
              $localize`Kampagne konnte nicht beendet werden.` +
                ' ' +
                $localize`Fehlermeldung: ${error.message}`
            );
          },
        });
    });
  }

  sendCampaignResults() {
    const dialogRef = this.dialog.open(WarnDialogComponent, {
      data: {
        text: $localize`Möchten Sie die Ergebnismails der Kampagne "${this.campaign.name}" wirklich senden?`,
        affirmButton: $localize`Senden`,
      },
    });

    dialogRef.afterClosed().subscribe((accepted: boolean) => {
      if (accepted)
        this.pgtService
          .sendCampaignResults(this.campaign.campaignId)
          .subscribe({
            next: (mailsSent: MailsSent) => {
              this.snackBarService.openSnackBar(
                $localize`Ergebnismails der Kampagne "${this.campaign.name}" erfolgreich gesendet.` +
                  ' ' +
                  $localize`Anzahl gesendete Mails: Teilnehmer: ${mailsSent.peerMailsSent}; Admins: ${mailsSent.adminMailsSent}.`
              );
              this.reloadEvent.emit('end');
            },
            error: (error: HttpErrorResponse) => {
              this.snackBarService.openSnackBar(
                $localize`Mails konnten nicht gesendet werden.` +
                  ` ` +
                  $localize`Fehlermeldung: ${error.message}`
              );
            },
          });
    });
  }

  /**
   * before sending mails, the user is prompted to confirm.
   */
  sendReminderMails() {
    const dialogRef = this.dialog.open(WarnDialogComponent, {
      data: {
        text: $localize`Möchten Sie den Peers mit ausstehenden Gradings der Kampagne "${this.campaign.name}" eine Erinnerungsmail zusenden?`,
        affirmButton: $localize`Senden`,
      },
    });

    dialogRef.afterClosed().subscribe((accepted: boolean) => {
      if (accepted)
        this.pgtService.sendReminderMails(this.campaign.campaignId).subscribe({
          next: (mailsSent: MailsSent) => {
            this.snackBarService.openSnackBar(
              $localize`Erinnerungsmails der Kampagne "${this.campaign.name}" erfolgreich gesendet.` +
                ' ' +
                $localize`Anzahl gesendete Mails: Teilnehmer: ${mailsSent.peerMailsSent}; Admins: ${mailsSent.adminMailsSent}.`
            );
          },
          error: (error: HttpErrorResponse) => {
            this.snackBarService.openSnackBar(
              $localize`Mails konnten nicht gesendet werden.` +
                ` ` +
                $localize`Fehlermeldung: ${error.message}`
            );
          },
        });
    });
  }

  /**
   * returns a string for a tooltip when hovering over the send reminder mails button
   * @param campaign
   */
  getReminderTooltip(): string {
    if (this.getCampaignStatus() == 'erstellt')
      return $localize`Bei noch nicht begonnenen Kampagnen können keine Erinnerungsnachrichten gesendet werden.`;
    if (this.gradingsComplete())
      return $localize`Bei kompletten Kampagnen können keine Erinnerungsnachrichten gesendet werden.`;
    if (this.getCampaignStatus() == 'abgeschlossen')
      return $localize`Bei beendeten Kampagnen können keine Erinnerungsnachrichten gesendet werden.`;
    return $localize`Benachrichtigt alle Teilnehmer der Kampagne, welche das Grading noch nicht gesendet haben.`;
  }

  /**
   * returns a string for a tooltip when hovering over the send reminder mails button
   * @param campaign
   */
  getEndingTooltip(): string {
    if (this.getCampaignStatus() == 'erstellt')
      return $localize`Kampagne wurde noch nicht begonnen.`;
    return $localize`Gradings können nachträglich nicht mehr gesendet werden.`;
  }

  getEndingButtonText(): string {
    if (this.getCampaignStatus() == 'abgeschlossen') {
      return $localize`Abschlussmails erneut senden`;
    }
    return $localize`Kampagne beenden`;
  }

  toSummary() {
    this.router.navigate(['/campaign-summary/' + this.campaign.campaignId]);
  }

  /**
   * before deleting a campaign, the user is prompted to confirm.
   * @param campaign
   */
  deleteCampaign() {
    const dialogRef = this.dialog.open(WarnDialogComponent, {
      data: {
        text: $localize`Möchten Sie die Kampagne "${this.campaign.name}" wirklich löschen?`,
      },
    });

    dialogRef.afterClosed().subscribe((shouldDelete: boolean) => {
      if (shouldDelete)
        this.pgtService.deleteCampaign(this.campaign).subscribe({
          next: () => {
            this.snackBarService.openSnackBar(
              $localize`Kampagne "${this.campaign.name}" wurde gelöscht`
            );
            this.reloadEvent.emit('delete');
          },
          error: (error: HttpErrorResponse) => {
            this.snackBarService.openSnackBar(
              $localize`Kampagne "${this.campaign.name}" konnte nicht gelöscht werden.` +
                ` ` +
                $localize`Fehlermeldung: ${error.message}`
            );
          },
        });
    });
  }

  /**
   * this method lets the backend generate a pdf so the user can download it
   */
  exportCampaignAsPdf() {
    this.pgtService.getCampaignSummaryPDF(this.campaign.campaignId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.setAttribute('style', 'display: none');
        a.href = url;
        a.download = `${
          this.campaign.name
        }_${new Date().toLocaleDateString()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (error: HttpErrorResponse) => {
        this.snackBarService.openSnackBar(
          $localize`Kampagne konnte nicht exportiert werden.` +
            ` ` +
            $localize`Fehlermeldung: ${error.message}`
        );
      },
    });
  }

  /**
   * this method lets the backend generate a excel so the user can download it
   */
  exportCampaignAsExcel() {
    this.pgtService
      .getCampaignSummaryExcel(this.campaign.campaignId)
      .subscribe({
        next: (res: any) => {
          const blob = new Blob([res]);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.setAttribute('style', 'display: none');
          a.href = url;
          a.download = `${
            this.campaign.name
          }_${new Date().toLocaleDateString()}.xlsx`;

          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBarService.openErrorBar(error);
        },
      });
  }

  getCampaignStatus(): CampaignStatus {
    return this.campaignService.getCampaignStatus(this.campaign);
  }

  gradingsComplete(): boolean {
    return this.campaignService.gradingsComplete(this.campaign);
  }
}
