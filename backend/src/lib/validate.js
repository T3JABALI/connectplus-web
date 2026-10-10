import { z } from 'zod';
import { HttpError } from '../errors.js';
import { normalizePhone } from './phone.js';

export const phoneSchema = z
  .string({ required_error: 'Enter a phone number.', invalid_type_error: 'Enter a valid Kenyan phone number.' })
  .transform((v) => normalizePhone(v))
  .refine((v) => v !== null, { message: 'Enter a valid Kenyan phone number, like 0712 345 678.' });

// Returns the parsed data or throws a 400 whose message is safe to show to the customer.
export function parse(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message || 'Check your details and try again.');
  return r.data;
}

export { z };
