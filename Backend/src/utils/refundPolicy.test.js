import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRefundForCancellation } from './refundPolicy.js';

test('returns full refund for bookings canceled 24 hours or more before start', () => {
  const now = new Date('2026-07-15T10:00:00Z');
  const bookingStart = new Date('2026-07-16T10:00:00Z');

  const result = calculateRefundForCancellation(now, bookingStart, 1000);

  assert.equal(result.refundPercentage, 100);
  assert.equal(result.refundAmount, 1000);
  assert.equal(result.refundType, 'full');
});

test('returns partial refund for bookings canceled between 12 and 24 hours before start', () => {
  const now = new Date('2026-07-15T10:00:00Z');
  const bookingStart = new Date('2026-07-16T00:00:00Z');

  const result = calculateRefundForCancellation(now, bookingStart, 1000);

  assert.equal(result.refundPercentage, 70);
  assert.equal(result.refundAmount, 700);
  assert.equal(result.refundType, 'partial');
});

test('returns no refund for bookings canceled within 6 hours before start', () => {
  const now = new Date('2026-07-15T10:00:00Z');
  const bookingStart = new Date('2026-07-15T15:00:00Z');

  const result = calculateRefundForCancellation(now, bookingStart, 1000);

  assert.equal(result.refundPercentage, 0);
  assert.equal(result.refundAmount, 0);
  assert.equal(result.refundType, 'none');
});
