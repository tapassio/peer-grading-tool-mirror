import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Campaign, Peer } from 'src/app/interfaces';
import { GradingComponent } from '../grading.component';

/**
 * this component displays each row of the form in the grading component
 */
@Component({
    selector: 'pgt-single-row',
    templateUrl: './single-row.component.html',
    styleUrls: ['./single-row.component.css', '../../app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SingleRowComponent {
  @Input() toPeer: Peer;
  @Input() peer: Peer;
  @Input() campaign: Campaign;
  @Input() gradingsFormGroup: any;

  constructor(private gradingComponent: GradingComponent) {}

  /**
   * this function is called in the html to calculate the average of a row
   * @param toPeer
   * @returns
   */
  getPeersAverage(toPeer: Peer): number {
    if (this.peer) {
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
