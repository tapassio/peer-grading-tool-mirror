import {
  Component,
  HostListener,
  OnInit,
  Signal,
  effect,
  signal,
} from '@angular/core';
import {
  Campaign,
  CampaignStatus,
  DeactivatableComponent,
  Language,
} from '../interfaces';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { CreateCampaignService } from './create-campaign.service';

/**
 * This component lets admin users create or edit campaigns
 */
import {
  DEFAULT_GRADE_ROUNDING,
  gradeRoundingOf,
} from '../services/campaign.service';

@Component({
  selector: 'pgt-create-campaign',
  templateUrl: './create-campaign.component.html',
  styleUrls: ['../app.component.css', './create-campaign.component.css'],
})
export class CreateCampaignComponent implements OnInit, DeactivatableComponent {
  campaignId: Signal<number | undefined> = signal(
    this.activatedRoute.snapshot.params['id']
  );
  campaignForm: FormGroup;

  languageSelection: {
    lang: Language;
    text: string;
  }[] = [
    {
      lang: 'de',
      text: $localize`Deutsch`,
    },
    {
      lang: 'en',
      text: $localize`Englisch`,
    },
  ];

  // TODO: fix this hacky solution
  // the problem with this component is that it mutates the object wihout the service updating the signal
  campaignListener = effect(() => {
    this.onCampaignUpdate(
      this.createCampaignService.campaign(),
      this.createCampaignService.campaignStatus()
    );
  });

  constructor(
    private formBuilder: FormBuilder,
    private activatedRoute: ActivatedRoute,
    public createCampaignService: CreateCampaignService
  ) {}

  /**
   * Upon initialization the component checks if it has to load an already existing campaign by looking up the url
   * If not a new campaign object is created
   */
  ngOnInit(): void {
    // creating the form for the general campaign data
    // values then get set when the actual campaign is loaded
    this.campaignForm = this.formBuilder.group({
      name: [, Validators.required],
      maxPoints: [
        ,
        [Validators.required, Validators.min(3), Validators.pattern('\\d+')],
      ],
      language: [, Validators.required],
      allowCommentsForPeers: [, Validators.required],
      gradeRounding: [DEFAULT_GRADE_ROUNDING, Validators.required],
    });

    // triggering the campaign loading in the service
    this.createCampaignService.loadCampaign(this.campaignId());

    // subscribe to changed values and set campaign values
    // special case for language change
    this.campaignForm.valueChanges.subscribe((value) => {
      this.createCampaignService.updateUnsavedChanges(
        true,
        'general campaign data edited'
      );
      if (
        value.language &&
        this.createCampaignService.campaign().language != value.language
      ) {
        this.createCampaignService.handleCampaignLanguageChange(
          this.createCampaignService.campaign(),
          value.language
        );
      }
      this.createCampaignService.updateCampaignValues(value);
    });
  }

  /**
   * this method prevents navigating away with unsaved changes using Hostlistener and the the saved-changes guard
   * @returns if changes to the campaign were saved
   */
  // @HostListener allows us to also guard against browser refresh, close, etc.
  @HostListener('window:beforeunload')
  canDeactivate(): Observable<boolean> | boolean {
    // returning true will navigate without confirmation
    // returning false will show a confirm dialog before navigating away
    return !this.createCampaignService.unsavedChanges();
  }

  /**
   * How the final grade (and the deviation) is rounded. Default: half grades
   * (Swiss grading). Other schools / grading systems can choose another step.
   */
  readonly gradeRoundingOptions = [
    { step: 0.5, text: $localize`Halbe Noten (z. B. 4.5) – Standard` },
    { step: 0.25, text: $localize`Viertelnoten (z. B. 4.25)` },
    { step: 0.1, text: $localize`Zehntelnoten (z. B. 4.3)` },
    { step: 1, text: $localize`Ganze Noten (z. B. 4)` },
    { step: 0, text: $localize`Nicht runden (2 Nachkommastellen)` },
  ];

  getP2PToggleString() {
    return this.campaignForm.controls['allowCommentsForPeers'].value
      ? $localize`Ja`
      : $localize`Nein`;
  }

  onCampaignUpdate(campaign: Campaign, campaignStatus: CampaignStatus) {
    // this.campaign = this.createCampaignService.campaign();
    // setting the campaignForms values to the campaign
    this.campaignForm.patchValue(
      {
        name: campaign.name,
        maxPoints: campaign.maxPoints,
        language: campaign.language,
        allowCommentsForPeers: campaign.allowCommentsForPeers,
        gradeRounding: gradeRoundingOf(campaign),
      },
      {
        emitEvent: false,
      }
    );
    if (campaignStatus == 'abgeschlossen') {
      this.campaignForm.disable({
        emitEvent: false,
      });
    }
    if (campaignStatus == 'läuft') {
      this.campaignForm.controls['maxPoints'].disable({ emitEvent: false });
      this.campaignForm.controls['language'].disable({ emitEvent: false });
      this.campaignForm.controls['allowCommentsForPeers'].disable({
        emitEvent: false,
      });
    }
    if (campaignStatus == 'erstellt') {
      this.campaignForm.enable({
        emitEvent: false,
      });
    }
  }

  /**
   * adds a new empty group to the campaign
   */
  addGroup() {
    this.createCampaignService.addGroup();
  }

  /**
   * this method is called by a button on the html
   * it let's the user upload a CSV file
   */
  public importCSV(event: Event) {
    this.createCampaignService.importCSV(
      this.createCampaignService.campaign(),
      event
    );
  }

  /**
   * this method is triggered by the submit button
   * @param campaignForm
   */
  submit() {
    if (this.campaignForm.valid) {
      this.createCampaignService.submitCampaign(
        this.createCampaignService.campaign()
      );
    } else {
      this.campaignForm.markAllAsTouched();
    }
  }
}
