import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ObjectSchema } from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private schema: ObjectSchema) {}

  transform(value: any, _metadata: ArgumentMetadata) {
    const validation = this.schema.validate(value);
    if (validation.error) {
      throw new BadRequestException('Validation failed');
    }
    return value;
  }
}
