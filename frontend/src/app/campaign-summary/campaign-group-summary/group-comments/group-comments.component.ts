import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Peer, PeerComment } from 'src/app/interfaces';

@Component({
    selector: 'pgt-group-comments',
    templateUrl: './group-comments.component.html',
    styleUrl: './group-comments.component.css',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GroupCommentsComponent {
  @Input() comments: PeerComment[];
  @Input() peers: Peer[];

  filterCommentsByPeer(peer: Peer): PeerComment[] {
    return this.comments.filter(
      (comment: PeerComment) => comment.fromPeer.peerId == peer.peerId
    );
  }
}
