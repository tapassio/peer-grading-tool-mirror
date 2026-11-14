import {
  Injectable,
  Signal,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';
import {
  Campaign,
  CampaignStatus,
  Criteria,
  Group,
  Language,
  Peer,
} from '../interfaces';
import { PGTService } from '../services/pgt.service';
import { CampaignService } from '../services/campaign.service';
import { CsvService } from './csv.service';
import { SnackBarService } from '../services/snack-bar.service';
import { WarnDialogComponent } from '../warn-dialog/warn-dialog.component';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { DEFAULT_CRITERIA } from './default-criteria';

/** max. points of the Swiss school grade scale (1-6), default for new campaigns */
export const SWISS_GRADE_SCALE_MAX = 6;

@Injectable({
  providedIn: 'root',
})
export class CreateCampaignService {
  defaultCriteria: { de: Criteria[]; en: Criteria[] } = DEFAULT_CRITERIA;

  campaign: WritableSignal<Campaign> = signal(this.createNewCampaign(), {
    // always "changed", so every set() updates the views
    equal: () => {
      return false;
    },
  });

  // holds an array of strings that hold information on invalid campaign data
  campaignErrors: WritableSignal<string[]> = signal([]);

  // tracks if the campaign must be updated or created when submitting
  campaignExisted: WritableSignal<boolean> = signal(false);

  // tracks the campaignstatus wich is used to know what fields can be edited
  campaignStatus: Signal<CampaignStatus> = computed(() =>
    this.campaignService.getCampaignStatus(this.campaign())
  );

  // tracks if changes have been made to the campaign
  unsavedChanges: WritableSignal<boolean> = signal(false);

  // tracks if the campaign is currently saving is currently saving
  saving: WritableSignal<boolean> = signal(false);

  csvErrors: Signal<string[]> = this.csvService.csvErrors.asReadonly();

  constructor(
    private pgtService: PGTService,
    private campaignService: CampaignService,
    private csvService: CsvService,
    private snackBarService: SnackBarService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  loadCampaign(campaignId: number | undefined) {
    // if there was a campaignId, try to load the campaign
    if (campaignId != undefined) {
      this.pgtService.getCampaignById(campaignId).subscribe({
        next: (campaign: Campaign) => {
          this.campaign.set(this.campaignService.cleanupCampaignData(campaign));
          this.setVariablesOnLoad(true);
        },
        error: (error: HttpErrorResponse) => {
          this.snackBarService.openErrorBar(error);
          this.router.navigate(['/admin-dashboard']);
        },
      });
    } else {
      // if there was no campaignId: create a new campaign
      this.campaign.set(this.createNewCampaign());
      this.setVariablesOnLoad(false);
    }
  }

  private setVariablesOnLoad(campaignExisted: boolean) {
    this.saving.set(false);
    this.updateUnsavedChanges(false, 'campaign loaded');

    this.campaignExisted.set(campaignExisted);

    // resetting csvErrors, because if the user made two campaigns and the first had errors while importing
    // it would still be shown the second time
    this.csvService.csvErrors.set([]);
  }

  private createNewCampaign(): Campaign {
    const campaign = this.campaignService.campaignConstructor(
      '',
      // default: Swiss school grade scale 1-6 (6 = best, 4 = sufficient)
      SWISS_GRADE_SCALE_MAX,
      'de',
      true,
      undefined,
      undefined,
      undefined,
      [],
      JSON.parse(JSON.stringify(this.defaultCriteria.de))
    );

    return campaign;
  }

  updateCampaignValues(values: any) {
    const campaign = this.campaign();
    for (const key in values) {
      (campaign as any)[key] = values[key];
    }
    this.campaign.set(campaign);
  }

  updateUnsavedChanges(value: boolean, _reason: string) {
    this.unsavedChanges.set(value);
  }

  handleCampaignLanguageChange(campaign: Campaign, language: Language) {
    // (bug fixed: compared the constant 'de' instead of the new language)
    const languageName = language === 'de' ? $localize`Deutsch` : $localize`Englisch`;
    this.dialog
      .open(WarnDialogComponent, {
        data: {
          text: $localize`Sollen die Kriterien auf die Standard-Kriterien in ${languageName} zurückgesetzt werden?`,
          affirmButton: $localize`Bestätigen`,
          title: $localize`Sprache geändert`,
        },
      })
      .afterClosed()
      .subscribe((shouldChange: boolean) => {
        if (shouldChange) {
          this.updateUnsavedChanges(true, 'swap criteria languages');
          campaign.criteria = JSON.parse(
            JSON.stringify(this.defaultCriteria[language])
          );
        }
      });
  }

  addCriteria(campaign: Campaign, criteria: Criteria) {
    this.updateUnsavedChanges(true, 'criteria added');
    this.campaignService.addCriteria(campaign, criteria);
    this.campaign.set(campaign);
  }

  removeCriteria(campaign: Campaign, criteria: Criteria) {
    this.updateUnsavedChanges(true, 'criteria removed');
    this.campaignService.removeCriteria(campaign, criteria);
    this.campaign.set(campaign);
  }

  addGroup() {
    this.updateUnsavedChanges(true, 'group added');
    const group = this.campaignService.groupConstructor(0, [], [], false, [], 0);
    this.campaignService.addGroup(this.campaign(), group);
    this.campaign.set(this.campaign());
  }

  removeGroup(group: Group) {
    this.updateUnsavedChanges(true, 'group removed');
    this.campaignService.removeGroup(this.campaign(), group);
    this.campaign.set(this.campaign());
  }

  addPeer(group: Group) {
    this.updateUnsavedChanges(true, 'peer added');
    this.campaignService.addPeer(
      group,
      this.campaignService.peerConstructor('', '', '', '')
    );
  }

  removePeer(group: Group, peer: Peer) {
    this.updateUnsavedChanges(true, 'peer removed');
    this.campaignService.removePeerFromGroup(group, peer);
  }

  importCSV(campaign: Campaign, event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const files: FileList | null = target.files;
    if (target && files) {
      const file: File = files[0];
      const reader: FileReader = new FileReader();
      reader.readAsText(file);
      let csv: string;
      reader.onload = () => {
        csv = reader.result as string;
        // the csv Service handles generating the groups
        campaign.groups = this.csvService.generateGroupsByCSV(csv);
        this.campaign.set(campaign);
      };
    }
    target.value = ''; // this line prevents a bug where all CSVs uploaded after the first one are ignored
    this.updateUnsavedChanges(true, 'csv imported');
  }

  submitCampaign(campaign: Campaign) {
    this.computeCampaignErrors(campaign);

    if (this.campaignErrors().length == 0) {
      // the user is prompted before sending the campaign if there are unsaved changes and it's currently open
      if (this.campaignStatus() == 'läuft' && this.unsavedChanges()) {
        const dialogRef = this.dialog.open(WarnDialogComponent, {
          data: {
            text: $localize`Bestimmte Änderungen an laufenden Kampagnen lösen automatisch Mails aus.`,
            affirmButton: $localize`Fortfahren`,
          },
        });

        dialogRef.afterClosed().subscribe((shouldSave: boolean) => {
          if (!shouldSave) return;
          this.saveCampaign(campaign);
        });
      } else {
        this.saveCampaign(campaign);
      }
    } else {
      // is run when an error occured when checking campaign data integrity
      this.snackBarService.openSnackBar(
        this.campaignErrors().join(' '),
        $localize`Schliessen`,
        Math.max(this.campaignErrors().length * 3000, 15000)
      );
    }
  }

  private saveCampaign(campaign: Campaign) {
    this.saving.set(true);

    if (this.campaignExisted()) {
      this.pgtService.updateCampaign(campaign).subscribe({
        next: (res: Campaign) => {
          this.snackBarService.openSnackBar(
            $localize`Kampagne "${campaign.name}" wurde gespeichert`
          );
          this.saving.set(false);
          this.updateUnsavedChanges(false, 'update campaign submitted');
          this.router.navigate(['/campaign-summary/' + res.campaignId]);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.snackBarService.openSnackBar(
            `Kampagne konnte nicht gespeichert werden.` +
              ` ` +
              $localize`Fehlermeldung: ${error.message}`
          );
        },
      });
    } else {
      this.pgtService.createCampaign(campaign).subscribe({
        next: (res: Campaign) => {
          this.snackBarService.openSnackBar(
            $localize`Kampagne "${campaign.name}" wurde gespeichert`
          );
          this.saving.set(false);
          this.updateUnsavedChanges(false, 'campaign create submitted');
          this.router.navigate(['/campaign-summary/' + res.campaignId]);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.snackBarService.openSnackBar(
            $localize`Kampagne konnte nicht gespeichert werden.` +
              ` ` +
              $localize`Fehlermeldung: ${error.message}`
          );
        },
      });
    }
  }

  /**
   * this method checks if the data of the campaign makes sense
   */
  private computeCampaignErrors(campaign: Campaign) {
    const campaignErrors: string[] = [];

    if (!Number.isInteger(campaign.maxPoints)) {
      campaignErrors.push(
        $localize`Maximale Punktzahl muss eine Ganzzahl sein.`
      );
    }

    if (campaign.criteria.length == 0) {
      campaignErrors.push($localize`Keine Kriterien erfasst.`);
    }

    if (campaign.groups.length == 0) {
      campaignErrors.push($localize`Keine Gruppen erfasst.`);
    }

    for (const group of campaign.groups) {
      if (group.peers.length == 0) {
        campaignErrors.push(
          $localize`Keine Teilnehmenden in Gruppe ${group.number}.`
        );
      }

      const emailSet = new Set<string>();

      for (const email of group.peers.map((p) => p.email)) {
        if (emailSet.has(email)) {
          campaignErrors.push(
            $localize`Peers mit identischer E-Mail Adresse in Gruppe ${group.number}`
          );
          break;
        }
        emailSet.add(email);
      }

      if (group.peers.some((peer) => this.peerDataInvalid(peer))) {
        campaignErrors.push(
          $localize`Ungültige Peer Daten in Gruppe ${group.number}`
        );
      }
    }

    this.campaignErrors.set(campaignErrors);
  }

  private peerDataInvalid(peer: Peer): boolean {
    if (
      peer.email.match(
        '([a-zA-Z0-9_\\-\\.]+)@([a-zA-Z0-9_\\-\\.]+)\\.([a-zA-Z]{2,5})'
      ) == null
    ) {
      return true;
    }

    if (peer.lastName.trim() == '') {
      return true;
    }

    if (peer.firstName.trim() == '') {
      return true;
    }

    return false;
  }
}
