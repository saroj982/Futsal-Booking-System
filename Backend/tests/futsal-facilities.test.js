import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFacilities } from '../src/controllers/futsalController.js';

test('normalizeFacilities converts legacy boolean facilities into a text list', () => {
  const facilities = normalizeFacilities({
    changingRooms: true,
    freeWater: false,
    nightLight: true,
    parking: false,
  });

  assert.deepEqual(facilities, ['Changing rooms', 'Night light']);
});

test('normalizeFacilities trims and deduplicates custom facility entries', () => {
  const facilities = normalizeFacilities(['  Changing rooms  ', 'Free water', 'Changing rooms']);

  assert.deepEqual(facilities, ['Changing rooms', 'Free water']);
});
