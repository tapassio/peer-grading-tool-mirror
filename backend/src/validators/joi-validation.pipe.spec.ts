import * as Joi from 'joi';
import { BadRequestException } from '@nestjs/common';
import { JoiValidationPipe } from './joi-validation.pipe';
import { registerSchema } from './joi-objects';

describe('JoiValidationPipe', () => {
  const pipe = new JoiValidationPipe(Joi.object({ a: Joi.number() }));

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('rejects unknown fields', () => {
    expect(() => pipe.transform({ a: 1, isAdmin: true }, null)).toThrow(
      BadRequestException,
    );
  });
});

describe('registerSchema', () => {
  const valid = {
    email: 'a@example.com',
    emailRepeat: 'a@example.com',
    password: 'long-enough-1',
    passwordRepeat: 'long-enough-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
  };

  it('accepts valid data', () => {
    expect(registerSchema.validate(valid).error).toBeUndefined();
  });

  it('rejects short passwords', () => {
    const data = { ...valid, password: 'short', passwordRepeat: 'short' };
    expect(registerSchema.validate(data).error).toBeDefined();
  });

  it('rejects different password repeat', () => {
    const data = { ...valid, passwordRepeat: 'something-else' };
    expect(registerSchema.validate(data).error).toBeDefined();
  });
});
