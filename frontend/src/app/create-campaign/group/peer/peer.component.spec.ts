import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testImports, testSchemas, testGroup, testPeer } from '../../../testing/test-helpers';
import { PeerComponent } from './peer.component';

describe('PeerComponent', () => {
  let component: PeerComponent;
  let fixture: ComponentFixture<PeerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...testImports],
      declarations: [PeerComponent],
      providers: [],
      schemas: testSchemas,
    }).compileComponents();

    fixture = TestBed.createComponent(PeerComponent);
    component = fixture.componentInstance;
    component.group = testGroup();
    component.peer = testPeer();
    component.campaignStatus = 'erstellt' as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
