import { Component, OnInit, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Campaign, CampaignStatus, Criteria } from 'src/app/interfaces';
import { CampaignService } from '../../services/campaign.service';
import { CreateCampaignService } from '../create-campaign.service';
import { FormErrorComponent } from '../../form-error/form-error.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
/**
 * This is a child component of the create campaign component
 * It handles displaying all data regarding criteria
 */
@Component({
    selector: 'pgt-criteria',
    templateUrl: './criteria.component.html',
    styleUrls: ['../../app.component.css', './criteria.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, FormErrorComponent, MatButton, MatIcon]
})
export class CriteriaComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private createCampaignService = inject(CreateCampaignService);
  private campaignService = inject(CampaignService);

  criteriaForm: FormGroup;
  readonly campaign = input.required<Campaign>();
  readonly campaignStatus = input.required<CampaignStatus>();

  /**
   * CreateCampaignService changes the campaign object in place (e.g. resets
   * the criteria after a language change). Reading its signal here makes this
   * OnPush component redraw on every change.
   */
  criteriaList(): Criteria[] {
    return this.createCampaignService.campaign().criteria;
  }

  ngOnInit(): void {
    // creating the form for the criteria
    this.criteriaForm = this.formBuilder.group({
      criteriaName: [null, Validators.required],
      criteriaWeight: [null, [Validators.required, Validators.min(0)]],
    });

    if (this.campaignStatus() !== 'erstellt') this.criteriaForm.disable();
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
      this.createCampaignService.addCriteria(this.campaign(), criteria);
      criteriaForm.reset();
    } else {
      criteriaForm.markAllAsTouched();
    }
  }

  removeCriteria(criteria: Criteria) {
    this.createCampaignService.removeCriteria(this.campaign(), criteria);
  }
}
