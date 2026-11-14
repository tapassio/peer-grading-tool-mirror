import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { Group } from '../interfaces';
import { CampaignService } from '../services/campaign.service';

interface LineValidation {
  valid: boolean;
  invalidMessage?: string;
}

/**
 * This service is used when importing CSV data
 */
@Injectable({
  providedIn: 'root',
})
export class CsvService {
  campaignService: CampaignService = inject(CampaignService);

  csvErrors: WritableSignal<string[]> = signal([]);

  /**
   * this method generates the groups from the CSV
   * @param csv the CSV as a string
   */
  generateGroupsByCSV(csv: string): Group[] {
    this.csvErrors.set([]);

    let groups: Group[] = [];
    const lines = csv.split(/\r?\n/);

    const firstLine: string[] = this.splitLine(lines[0]).map(
      (colName: string) => colName.toLowerCase().trim()
    );

    const lastNameIndex = this.findColumnIndex(
      firstLine,
      (colName) => colName.includes('name') && !colName.includes('vorname')
    );
    const firstNameIndex = this.findColumnIndex(firstLine, (colName) =>
      colName.includes('vorname')
    );
    const eMailIndex = this.findColumnIndex(firstLine, (colName) =>
      colName.includes('mail')
    );
    const groupIndex = this.findColumnIndex(firstLine, (colName) =>
      colName.includes('gruppe')
    );
    const matriculationNumberIndex = this.findColumnIndex(
      firstLine,
      (colName) => colName.includes('matrikel')
    );

    if (
      lastNameIndex == -1 ||
      firstNameIndex == -1 ||
      eMailIndex == -1 ||
      groupIndex == -1
    ) {
      this.addError($localize`Ist das CSV gemäss der Vorlage aufgebaut?`);
      return [];
    }

    for (const [index, line] of lines.entries()) {
      // skipping the first line and empty lines
      if (index == 0 || line == '') {
        continue;
      }

      const splittedLine: string[] = this.splitLine(line).map((cell: string) =>
        cell.trim()
      );

      // storing the values
      const lastName = splittedLine[lastNameIndex];
      const firstName = splittedLine[firstNameIndex];
      const email = splittedLine[eMailIndex];
      const groupNumberString: string = splittedLine[groupIndex];
      const matriculationNumber =
        matriculationNumberIndex >= 0
          ? splittedLine[matriculationNumberIndex]
          : '';

      // checking if the values are valid and storing them in a group
      // else pushing this line to the errors to display
      const lineValidation: LineValidation = this.validateLine(
        lastName,
        firstName,
        email,
        groupNumberString
      );

      if (!lineValidation.valid) {
        this.addError(
          $localize`Zeile` +
            ` ${index + 1} (${splittedLine.join(' | ')}): ${
              lineValidation.invalidMessage
            }`
        );
      }

      const groupNumber = Number(groupNumberString);

      let foundGroup = groups.find((gr) => gr.number == groupNumber);

      if (!foundGroup) {
        foundGroup = this.campaignService.groupConstructor(groupNumber);
        groups.push(foundGroup);
      }

      this.campaignService.addPeer(
        foundGroup,
        this.campaignService.peerConstructor(
          firstName,
          lastName,
          email,
          matriculationNumber
        )
      );
    }

    groups = this.updateGroupNumbers(groups);

    return groups;
  }

  private findColumnIndex(
    firstLine: string[],
    searchFunction: (colName: string) => boolean
  ): number {
    return firstLine.findIndex((colName: string) => searchFunction(colName));
  }

  private addError(errorMessage: string) {
    this.csvErrors.update((value: string[]) => [...value, errorMessage]);
  }

  private splitLine(line: string): string[] {
    // checking for semicolons, commas or tabs as separators
    const semicolonSplittedLine = line.split(';');
    const commaSplittedLine = line.split(',');
    const tabSplittedLine = line.split('\t');

    if (
      semicolonSplittedLine.length > commaSplittedLine.length &&
      semicolonSplittedLine.length > tabSplittedLine.length
    ) {
      return semicolonSplittedLine;
    }

    if (commaSplittedLine.length > tabSplittedLine.length) {
      return commaSplittedLine;
    }

    return tabSplittedLine;
  }

  private validateLine(
    lastName: string,
    firstName: string,
    email: string,
    groupNumber: string
  ): LineValidation {
    const lastNameValid = lastName.length !== 0;
    const firstNameValid = firstName.length !== 0;
    const emailValid =
      email.match(
        "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*\\.[a-zA-Z]{2,5}$"
      ) != null;
    const groupNumberValid = groupNumber.match('^\\d+$') != null;

    const invalidMessages: string[] = [];

    if (!lastNameValid) invalidMessages.push($localize`kein Nachname`);
    if (!firstNameValid) invalidMessages.push($localize`kein Vorname`);
    if (!emailValid) invalidMessages.push($localize`invalide E-mail Adresse`);
    if (!groupNumberValid)
      invalidMessages.push($localize`invalide Gruppennummer`);

    return {
      valid: lastNameValid && firstNameValid && emailValid && groupNumberValid,
      invalidMessage: `${invalidMessages.join(', ')}.`,
    };
  }

  private updateGroupNumbers(groups: Group[]): Group[] {
    // sorting according to group number
    const sortedGroups = groups.sort((a, b) => a.number - b.number);
    // find max group number
    const maxGroupNumber = sortedGroups[sortedGroups.length - 1]?.number || 0;

    // autonumbering if max is higher than the number of groups
    // meaning that a group number was missing
    if (maxGroupNumber !== groups.length) {
      this.campaignService.autoNumberGroups(groups);
      this.addError(
        $localize`Hinweis: Die Gruppen wurden beginnend mit Nr. 1 fortlaufend neu nummeriert.`
      );
    }

    return sortedGroups;
  }
}
