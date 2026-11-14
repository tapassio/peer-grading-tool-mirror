import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Peer, User } from 'src/app/interfaces';

@Component({
    selector: 'pgt-single-comment',
    templateUrl: './single-comment.component.html',
    styleUrl: './single-comment.component.css',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SingleCommentComponent implements OnInit {
  @Input() toUser: User;
  @Input() peer: Peer;
  @Input() commentFormGroup: any;
  @Input() isAdmin = false;

  peerCommentTooltip: string;

  ngOnInit(): void {
    // prettier-ignore
    this.peerCommentTooltip = $localize`Der eingegebene Kommentar ist sowohl für Dozierende, als auch für ${this.toUser.firstName} ${this.toUser.lastName} sichtbar.`;
  }
}
