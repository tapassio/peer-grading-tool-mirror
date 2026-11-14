import {
  Component,
  OnInit,
  Signal,
  WritableSignal,
  computed,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { of, switchMap } from 'rxjs';

import { PGTService } from '../services/pgt.service';
import { CampaignService } from '../services/campaign.service';
import {
  Campaign,
  Group,
  PeerComment,
  Peer,
  Grading,
  User,
} from '../interfaces';
import { ActivatedRoute, Router } from '@angular/router';
import { WarnDialogComponent } from '../warn-dialog/warn-dialog.component';
import { SnackBarService } from '../services/snack-bar.service';
import { MatDialog } from '@angular/material/dialog';

interface GradingData {
  campaign: Campaign;
  comments: PeerComment[] | undefined;
  group: Group;
  peer: Peer;
}

/**
 * this component lets peers enter their gradings and a comment
 */
@Component({
    selector: 'pgt-grading',
    templateUrl: './grading.component.html',
    styleUrls: ['./grading.component.css', '../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GradingComponent implements OnInit {
  url: Signal<string> = signal(this.activatedRoute.snapshot.params['url']);

  gradingData: WritableSignal<GradingData> = signal({
    campaign: this.campaignService.campaignConstructor('', 0, 'de'),
    group: this.campaignService.groupConstructor(),
    peer: this.campaignService.peerConstructor('', '', ''),
    comments: undefined,
  });

  campaign: Signal<Campaign> = computed(() =>
    this.campaignService.cleanupCampaignData(this.gradingData().campaign)
  );
  group: Signal<Group> = computed(() => this.gradingData().group);
  peer: Signal<Peer> = computed(() => this.gradingData().peer);

  // deriving users for the comments
  adminUsers: Signal<User[]> = computed(
    () => this.gradingData().campaign.users ?? []
  );
  peerUsers: Signal<User[]> = computed(() => this.getPeerUsersForComments());

  comments: Signal<PeerComment[] | undefined> = computed(
    () => this.gradingData().comments
  );

  // TODO: getting expression changed after checked error
  gradingForm: FormGroup;

  // these variables are also used in the html to display error messages
  formDisabled: WritableSignal<boolean> = signal(false);
  tooEarly: Signal<boolean> = computed(
    () => this.campaign().openingDate == undefined
  );

  constructor(
    public pgtService: PGTService,
    public campaignService: CampaignService,
    private activatedRoute: ActivatedRoute,
    private dialog: MatDialog,
    private formBuilder: FormBuilder,
    private snackBarService: SnackBarService,
    private router: Router
  ) {}

  /**
   * when the component is loaded, the data for this component is got using the url
   */
  ngOnInit(): void {
    this.pgtService.getGroupByLink(this.url()).subscribe({
      next: (data: GradingData) => {
        // formatting campaign data
        this.gradingData.set(data);

        // formDisabled is true if the amount of gradings is the same or higher as the max amount
        this.formDisabled.set(
          this.campaignService.getGradingsByPeer(this.group(), this.peer())
            .length >=
            this.group().peers.length * this.campaign().criteria.length ||
            this.campaignService.getCampaignStatus(this.campaign()) ==
              'abgeschlossen'
        );

        // lastly the form is built
        this.buildGradingForm();
      },
      error: (err) => {
        this.router.navigate([`error/${err.status}`]);
      },
    });
  }

  /**
   * this function builds the grading form
   */
  private buildGradingForm() {
    this.gradingForm = this.formBuilder.group({
      gradings: undefined,
      comments: undefined,
    });

    // initializing form groups
    const gradingFormGroup = this.formBuilder.group({});
    gradingFormGroup.setValidators(Validators.required);

    const commentsFormGroup = this.formBuilder.group({});

    // iterating over each peer of the group which corresponds with each row in the table
    for (const peer of this.group().peers) {
      // getting gradings to fill the form in case it has been entered before
      const peerToPeerGradings = this.campaignService.getPeerToPeerGradings(
        this.group(),
        this.peer(),
        peer
      );

      const peerFormgroup = new FormGroup({});

      // iterating over criteria which corresponds to each column in the table
      for (const crit of this.campaign().criteria) {
        // points is stored to set the value of the critControl
        // it is set to the value of the already exisisting grading or to undefined if the grading didn't exist
        const points = peerToPeerGradings.find(
          (grading) => grading.criteria.criteriaId === crit.criteriaId
        )
          ? peerToPeerGradings.find(
              (grading) => grading.criteria.criteriaId === crit.criteriaId
            )?.points
          : undefined;

        const critControl = new FormControl(points, [
          // whole or half points, e.g. 4 or 4.5 (Swiss half grades)
          Validators.pattern('^\\d+(\\.[05])?$'),
          Validators.min(1),
          Validators.max(this.campaign().maxPoints),
        ]);

        peerFormgroup.addControl('' + crit.criteriaId, critControl);
      }

      gradingFormGroup.addControl('' + peer.peerId, peerFormgroup);
    }

    // adding comment formControl for campaign admin
    for (const user of [...this.adminUsers(), ...this.peerUsers()]) {
      // trying to get already existing comment
      const textOfComment = this.comments()?.find(
        (comment: PeerComment) => comment.toUser.userId == user.userId
      )?.text;

      const commentFormControl = this.formBuilder.control(textOfComment);

      commentsFormGroup.addControl(`${user.userId}`, commentFormControl);
    }
    // adding comment formControl for peers
    for (const peer of this.group().peers) {
      // skipping peer himself
      if (peer.peerId === this.peer().peerId) {
        continue;
      }

      // trying to get already existing comment
      const textOfComment = this.comments()?.find(
        (comment: PeerComment) => comment.toUser.userId == (peer as any).userId
      )?.text;

      const commentFormControl = this.formBuilder.control(textOfComment);

      commentsFormGroup.addControl(
        `${(peer as any).userId}`,
        commentFormControl
      );
    }

    // adding the form groups
    this.gradingForm.setControl('gradings', gradingFormGroup);
    this.gradingForm.setControl('comments', commentsFormGroup);

    // if the gradings have been sent already or if it's too early, the whole form is disabled
    if (this.formDisabled() || this.tooEarly()) {
      this.gradingForm.disable();
    }
  }

  /**
   * this function generates all the gradings from a Peer to a peer
   * @param fromPeer
   * @param toPeer
   * @returns
   */
  generateGradings(toPeer: Peer): Grading[] {
    const gradings = new Array<Grading>();

    for (const crit of this.campaign().criteria) {
      gradings.push(
        this.campaignService.gradingConstructor(
          crit,
          this.peer(),
          toPeer,
          this.gradingForm.value.gradings[toPeer.peerId][crit.criteriaId]
        )
      );
    }

    return gradings;
  }

  sendButtonDisabled(): boolean {
    return this.tooEarly() || this.formDisabled() || this.gradingForm.invalid;
  }

  submit(gradingForm: FormGroup) {
    if (gradingForm.valid) {
      // getting comments that were not empty
      const comments: any = {};

      for (const userIdKey in gradingForm.value.comments) {
        if (
          gradingForm.value.comments[userIdKey] != null &&
          gradingForm.value.comments[userIdKey].trim() !== ''
        ) {
          comments[userIdKey] = gradingForm.value.comments[userIdKey].trim();
        }
      }

      // generating the gradings for each peer
      const gradings: Grading[] = [];
      for (const toPeer of this.group().peers) {
        gradings.push(...this.generateGradings(toPeer));
      }

      // setting up the data to transfer to the backend
      const data = {
        gradings,
        comments,
        groupId: this.group().groupId,
      };

      // the user is warned before submitting
      this.submitWarning()
        .pipe(
          switchMap((accepted) => {
            if (accepted) {
              return this.pgtService.addGradingsAndComment(this.url(), data);
            }
            return of(null);
          })
        )
        .subscribe({
          next: (response) => {
            if (response) {
              this.formDisabled.set(true);
              this.gradingForm.disable();
              this.snackBarService.openSnackBar(
                $localize`Gradings erfolgreich gesendet.`
              );
            }
          },
          error: () => {
            this.snackBarService.openSnackBar(
              $localize`Gradings konnten nicht gespeichert werden.`
            );
          },
        });
    } else {
      this.snackBarService.openSnackBar(
        $localize`Gradings können nicht gesendet werden. Werte müssen zwischen 1 und ${
          this.campaign().maxPoints
        } liegen (ganze oder halbe Punkte, z. B. 4.5).`
      );
      gradingForm.markAllAsTouched();
    }
  }

  submitWarning() {
    return this.dialog
      .open(WarnDialogComponent, {
        data: {
          text: $localize`Die Gradings und der Kommentar können nach dem Senden nicht mehr bearbeitet werden.`,
          affirmButton: $localize`Senden`,
        },
      })
      .afterClosed();
  }

  getPeerUsersForComments(): User[] {
    const peerUsers: User[] = this.group()
      .peers.filter((peer: Peer) => peer.peerId !== this.peer().peerId) // filtering the peer himself out
      .map((peer: Peer): User => {
        return {
          userId: (peer as any).userId,
          firstName: peer.firstName,
          lastName: peer.lastName,
          email: peer.email,
          roles: [], // have to do this as it's a required property of a user
        };
      });
    return [...peerUsers];
  }
}
