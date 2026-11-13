import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class AppService {
  /**
   * Creates the personal grading link of a peer.
   * The link works like a password (no login needed), so it has to be
   * random and impossible to guess: 32 random bytes = 256 bit.
   * The parameters are kept for compatibility but no longer used.
   */
  generateLink(_groupId?: number, _peerId?: number) {
    return randomBytes(32).toString('base64url');
  }

  formatLocaleDate(date: Date, lang: string): string {
    if (lang == 'en') {
      return date.toLocaleDateString(lang, {
        timeZone: 'Europe/Zurich',
        dateStyle: 'medium',
      });
    } else {
      return date.toLocaleDateString(lang, { timeZone: 'Europe/Zurich' });
    }
  }
}
