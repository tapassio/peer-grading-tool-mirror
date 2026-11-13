import { Logger } from '@nestjs/common';

const REQUIRED_SECRETS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_REGISTRATION_SECRET',
];

// values from .env.example and other obvious placeholders
const KNOWN_WEAK = /secret|changeme|password|example|test/i;
const MIN_LENGTH = 32;

/**
 * Checks the JWT secrets at startup.
 * Anyone who knows a secret can create valid login tokens for every user,
 * so weak or missing secrets are a critical problem.
 *
 * Production: the server does not start.
 * Development: only a warning is logged.
 */
export function checkSecrets(production: boolean) {
  const logger = new Logger('Security');
  const problems: string[] = [];

  for (const name of REQUIRED_SECRETS) {
    const value = process.env[name];
    if (!value) {
      problems.push(`${name} is missing`);
    } else if (value.length < MIN_LENGTH || KNOWN_WEAK.test(value)) {
      problems.push(
        `${name} is weak (use at least ${MIN_LENGTH} random characters, e.g. "openssl rand -base64 48")`,
      );
    }
  }

  const values = REQUIRED_SECRETS.map((n) => process.env[n]).filter(Boolean);
  if (new Set(values).size !== values.length) {
    problems.push('the JWT secrets must all be different');
  }

  if (problems.length === 0) return;

  if (production) {
    throw new Error('Insecure configuration: ' + problems.join('; '));
  }
  problems.forEach((p) => logger.warn(p + ' (allowed only in development)'));
}
