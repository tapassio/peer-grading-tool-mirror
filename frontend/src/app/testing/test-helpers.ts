/**
 * Shared helpers for the component tests ("should create" tests).
 *
 * - testImports: modules most components need (HTTP, router, forms,
 *   Material dialogs/snackbar, no animations)
 * - testSchemas: ignore unknown child components, so a test only checks
 *   its own component
 * - example data that matches the interfaces in ../interfaces.ts
 */
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Campaign, Criteria, Group, Peer, User, UserRole } from '../interfaces';

export const testImports = [
  HttpClientTestingModule,
  RouterTestingModule,
  FormsModule,
  ReactiveFormsModule,
  MatDialogModule,
  MatSnackBarModule,
  NoopAnimationsModule,
];

export const testSchemas = [NO_ERRORS_SCHEMA];

export function testCriteria(): Criteria[] {
  return [
    { criteriaId: 1, name: 'Teamfähigkeit', weight: 2 },
    { criteriaId: 2, name: 'Qualität', weight: 1 },
  ] as Criteria[];
}

export function testPeer(peerId = 1, firstName = 'Anna', lastName = 'Muster'): Peer {
  return {
    peerId,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}@students.example.org`,
    matriculationNumber: '',
  } as Peer;
}

export function testGroup(): Group {
  return {
    groupId: 10,
    number: 1,
    peers: [testPeer(1), testPeer(2, 'Ben', 'Keller')],
    gradings: [],
    completed: false,
    comments: [],
  } as Group;
}

export function testCampaign(): Campaign {
  return {
    campaignId: 1,
    name: 'Testkampagne',
    maxPoints: 6,
    language: 'de',
    allowCommentsForPeers: true,
    creationDate: new Date('2026-11-01'),
    openingDate: new Date('2026-11-05'),
    closingDate: undefined,
    groups: [testGroup()],
    criteria: testCriteria(),
    users: [],
  } as unknown as Campaign;
}

export function testUser(): User {
  return {
    userId: 900,
    firstName: 'Lea',
    lastName: 'Dozentin',
    email: 'lea@example.org',
    roles: [UserRole.ADMIN],
  } as unknown as User;
}

/** form group shaped like the one of the grading page: peerId -> criteriaId */
export function testGradingsForm(campaign: Campaign, peers: Peer[]): FormGroup {
  const group: Record<number, FormGroup> = {};
  for (const p of peers) {
    const controls: Record<number, FormControl> = {};
    for (const c of campaign.criteria) controls[c.criteriaId] = new FormControl('');
    group[p.peerId] = new FormGroup(controls);
  }
  return new FormGroup(group);
}
