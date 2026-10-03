import mongoose from 'mongoose';
import { badRequest, notFound } from './errors.js';

export function isObjectId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value) && mongoose.isValidObjectId(value);
}

/** Returns the id, or throws 404 with `label` (bad ids are treated as missing records). */
export function requireObjectId(value, label = 'Record') {
  if (!isObjectId(value)) throw notFound(`${label} not found.`);
  return value;
}

export function requireText(value, { field, min = 1, max }) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) {
    throw badRequest(min <= 1 ? `${field} can't be empty.` : `${field} must be at least ${min} characters.`);
  }
  if (max && text.length > max) throw badRequest(`${field} must be ${max} characters or fewer.`);
  return text;
}

export function parseLimit(value, { fallback = 10, max = 30 } = {}) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw badRequest('limit must be a positive whole number.');
  return Math.min(n, max);
}
