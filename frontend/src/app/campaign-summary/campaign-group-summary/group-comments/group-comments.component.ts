import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Peer, PeerComment } from 'src/app/interfaces';

@Component({
    selector: 'pgt-group-comments',
    templateUrl: './group-comments.component.html',
    styleUrl: './group-comments.component.css',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class GroupCommentsComponent {
  readonly comments = input.required<PeerComment[]>();
  readonly peers = input.required<Peer[]>();

  filterCommentsByPeer(peer: Peer): PeerComment[] {
    return this.comments().filter(
      (comment: PeerComment) => comment.fromPeer.peerId == peer.peerId
    );
  }
}
