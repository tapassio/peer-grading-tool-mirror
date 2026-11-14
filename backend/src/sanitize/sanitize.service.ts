import { Injectable } from '@nestjs/common';

import sanitizeHTML from 'sanitize-html';

@Injectable()
export class SanitizeService {
  sanitize(input: string): string {
    return sanitizeHTML(input, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'escape',
    });
  }
}
