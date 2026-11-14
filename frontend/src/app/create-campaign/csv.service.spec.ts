import { TestBed } from '@angular/core/testing';

import { CsvService } from './csv.service';
import { CampaignService } from '../services/campaign.service';

describe('CsvService', () => {
  let service: CsvService;
  let campaignServiceMock: Partial<CampaignService>;

  beforeEach(() => {
    // Create mock implementations for the campaignService methods
    campaignServiceMock = {
      groupConstructor: jest.fn().mockReturnValue({
        groupId: 1,
        number: 1,
        peers: [],
        gradings: [],
        completed: false,
        comments: [],
      }),
      addPeer: jest.fn(),
      peerConstructor: jest.fn().mockReturnValue({
        peerId: 1,
        firstName: 'John',
        lastName: 'Doe',
        matriculationNumber: '35-456-581',
        email: 'john.doe@example.com',
      }),
      autoNumberGroups: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CsvService,
        {
          provide: CampaignService,
          useValue: campaignServiceMock,
        },
      ],
    });
    service = TestBed.inject(CsvService);

    // Resetting signals before each test
    service.csvErrors.set([]);
  });

  it('should handle an empty CSV string', () => {
    const csv = '';
    const result = service.generateGroupsByCSV(csv);

    expect(result).toEqual([]); // No groups generated
    expect(service.csvErrors()).toContain(
      $localize`Ist das CSV gemäss der Vorlage aufgebaut?`
    );
  });

  it('should handle a CSV missing required columns', () => {
    const csv = 'Nachname;Vorname;E-Mail\nDoe;John;john.doe@example.com'; // No group number
    const result = service.generateGroupsByCSV(csv);

    expect(result).toEqual([]);
    expect(service.csvErrors()).toContain(
      $localize`Ist das CSV gemäss der Vorlage aufgebaut?`
    );
  });

  it('should handle a CSV missing optional Matrikel-Nr', () => {
    const csv =
      'Nachname;Vorname;E-Mail;Gruppennummer\nDoe;John;john.doe@example.com;1';
    const result = service.generateGroupsByCSV(csv);

    expect(result.length).toBe(1); // One group should be generated
    expect(service.csvErrors()).toEqual([]); // No errors
  });

  it('should handle CSV with "Mail" and "Gruppe" for email and group number columns', () => {
    const csv = 'Nachname;Vorname;Mail;Gruppe\nDoe;John;john.doe@example.com;1';
    const result = service.generateGroupsByCSV(csv);

    expect(result.length).toBe(1); // One group generated
    expect(service.csvErrors()).toEqual([]); // No errors
  });

  it('should handle a CSV with non-standard column order', () => {
    const csv =
      'Vorname;Nachname;E-Mail;Gruppennummer\nJohn;Doe;john.doe@example.com;1';
    const result = service.generateGroupsByCSV(csv);

    expect(result.length).toBe(1); // One group generated
    expect(service.csvErrors()).toEqual([]); // No errors
  });

  it('should ignore extra columns like "Geburtsdatum"', () => {
    const csv =
      'Nachname;Vorname;E-Mail;Gruppennummer;Geburtsdatum\nDoe;John;john.doe@example.com;1;01-01-1990';
    const result = service.generateGroupsByCSV(csv);

    expect(result.length).toBe(1); // One group generated
    expect(service.csvErrors()).toEqual([]); // No errors
  });

  it('should add peers to the same group for duplicate group numbers', () => {
    const csv = `name;vorname;mail;gruppe
    Doe;John;john@example.com;1
    Smith;Jane;jane@example.com;1`;

    service.generateGroupsByCSV(csv);

    expect(service.csvErrors()).toHaveLength(0);
    const groups = service.generateGroupsByCSV(csv);
    expect(groups).toHaveLength(1); // Only one group should exist
  });

  it('should log an error for invalid email addresses', () => {
    const csv = `name;vorname;mail;gruppe
    Doe;John;john@example;1`;

    service.generateGroupsByCSV(csv);

    expect(service.csvErrors()).toContain(
      'Zeile 2 (Doe | John | john@example | 1): invalide E-mail Adresse.'
    );
  });

  it('should log an error for empty required fields in a row', () => {
    const csv = `name;vorname;mail;gruppe
    Doe;;john@example.com;1`;

    service.generateGroupsByCSV(csv);

    expect(service.csvErrors()).toContain(
      'Zeile 2 (Doe |  | john@example.com | 1): kein Vorname.'
    );
  });

  it('should log an error for non-numeric group numbers', () => {
    const csv = `name;vorname;mail;gruppe
    Doe;John;john@example.com;abc`;

    service.generateGroupsByCSV(csv);

    expect(service.csvErrors()).toContain(
      'Zeile 2 (Doe | John | john@example.com | abc): invalide Gruppennummer.'
    );
  });

  it('should correctly parse the CSV when columns are not in the usual order', () => {
    const csv = `vorname;mail;gruppe;name
    John;john@example.com;1;Doe`;

    service.generateGroupsByCSV(csv);

    expect(service.csvErrors()).toHaveLength(0); // No errors should be reported
    const groups = service.generateGroupsByCSV(csv);
    expect(groups).toHaveLength(1); // There should be one group
  });
});
