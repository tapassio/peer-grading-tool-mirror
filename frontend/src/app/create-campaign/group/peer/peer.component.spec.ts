import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testGroup, testPeer } from '../../../testing/test-helpers';
import { PeerComponent } from './peer.component';

describe('PeerComponent', () => {
  let component: PeerComponent;
  let fixture: ComponentFixture<PeerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [...testImports, PeerComponent],
    providers: [],
    schemas: testSchemas,
}).compileComponents();

    fixture = TestBed.createComponent(PeerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', testGroup());
    fixture.componentRef.setInput('peer', testPeer());
    fixture.componentRef.setInput('campaignStatus', 'erstellt' as any);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
