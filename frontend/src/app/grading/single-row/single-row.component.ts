import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { Campaign, Peer } from 'src/app/interfaces';
import { GradingComponent } from '../grading.component';
import { ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

/**
 * this component displays each row of the form in the grading component
 */
@Component({
    selector: 'pgt-single-row',
    templateUrl: './single-row.component.html',
    styleUrls: ['./single-row.component.css', '../../app.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, DecimalPipe]
})
export class SingleRowComponent {
  private gradingComponent = inject(GradingComponent);

  readonly toPeer = input.required<Peer>();
  readonly peer = input.required<Peer>();
  readonly campaign = input.required<Campaign>();
  readonly gradingsFormGroup = input.required<any>();

  /**
   * this function is called in the html to calculate the average of a row
   * @param toPeer
   * @returns
   */
  getPeersAverage(toPeer: Peer): number {
    if (this.peer()) {
      const gradings = this.gradingComponent.generateGradings(toPeer);

      let sum = 0;
      let count = 0;
      for (const grading of gradings) {
        sum += grading.points * grading.criteria.weight;
        count += grading.criteria.weight;
      }
      return sum / count;
    }
    return 0;
  }
}
