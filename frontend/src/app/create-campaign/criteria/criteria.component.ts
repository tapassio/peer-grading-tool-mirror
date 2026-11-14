import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Campaign, CampaignStatus, Criteria } from 'src/app/interfaces';
import { CampaignService } from '../../services/campaign.service';
import { CreateCampaignService } from '../create-campaign.service';
/**
 * This is a child component of the create campaign component
 * It handles displaying all data regarding criteria
 */
@Component({
    selector: 'pgt-criteria',
    templateUrl: './criteria.component.html',
    styleUrls: ['../../app.component.css', './criteria.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CriteriaComponent implements OnInit {
  criteriaForm: FormGroup;
  @Input() campaign: Campaign;
  @Input() campaignStatus: CampaignStatus;

  constructor(
    private formBuilder: FormBuilder,
    private createCampaignService: CreateCampaignService,
    private campaignService: CampaignService
  ) {}

  ngOnInit(): void {
    // creating the form for the criteria
    this.criteriaForm = this.formBuilder.group({
      criteriaName: [null, Validators.required],
      criteriaWeight: [null, [Validators.required, Validators.min(0)]],
    });

    if (this.campaignStatus != 'erstellt') this.criteriaForm.disable();
  }

  /**
   * adds a new criteria to the campaign
   * @param criteriaForm used to get the values entered by the user
   */
  addCriteria(criteriaForm: FormGroup) {
    if (criteriaForm.valid) {
      const criteria = this.campaignService.criteriaConstructor(
        criteriaForm.value.criteriaName,
        criteriaForm.value.criteriaWeight
      );
      this.createCampaignService.addCriteria(this.campaign, criteria);
      criteriaForm.reset();
    } else {
      criteriaForm.markAllAsTouched();
    }
  }

  removeCriteria(criteria: Criteria) {
    this.createCampaignService.removeCriteria(this.campaign, criteria);
  }
}
