import { Component, Input, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CampaignStatus, Group, Peer } from '../../../interfaces';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CreateCampaignService } from '../../create-campaign.service';
import { FormErrorComponent } from '../../../form-error/form-error.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    // attribute selector on purpose: the component is a table row (<tr pgt-peer>)
    // eslint-disable-next-line @angular-eslint/component-selector
    selector: '[pgt-peer]',
    templateUrl: './peer.component.html',
    styleUrls: ['../../../app.component.css', './peer.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [ReactiveFormsModule, FormErrorComponent, MatButton, MatIcon]
})
export class PeerComponent implements OnInit {
  private createCampaignService = inject(CreateCampaignService);
  private formBuilder = inject(FormBuilder);

  @Input() peer: Peer;
  @Input() group: Group;
  @Input() campaignStatus: CampaignStatus;
  peerEditForm: FormGroup;

  ngOnInit(): void {
    this.peerEditForm = this.formBuilder.group({
      peerId: [this.peer.peerId, Validators.required],
      firstName: [this.peer.firstName, Validators.required],
      lastName: [this.peer.lastName, Validators.required],
      matriculationNumber: [this.peer.matriculationNumber],
      email: [
        this.peer.email,
        [
          Validators.required,
          Validators.pattern(
            "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*\\.[a-zA-Z]{2,5}$"
          ),
        ],
      ],
    });

    if (this.campaignStatus == 'abgeschlossen') {
      this.peerEditForm.disable();
    }

    // TODO: ideas to improve this hacky thing
    // store focused input
    // formbuilder update variable on change

    this.peerEditForm.valueChanges.subscribe((peer: Peer) => {
      this.createCampaignService.updateUnsavedChanges(true, 'peer edited');
      for (const key in peer) {
        (this.peer as any)[key] = (peer as any)[key];
      }
    });
  }

  removePeer() {
    this.createCampaignService.removePeer(this.group, this.peer);
  }
}
