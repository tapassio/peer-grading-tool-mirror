import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolTipComponent } from './tool-tip.component';

describe('ToolTipComponent', () => {
  let component: ToolTipComponent;
  let fixture: ComponentFixture<ToolTipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [ToolTipComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(ToolTipComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('text', 'Hilfetext');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
