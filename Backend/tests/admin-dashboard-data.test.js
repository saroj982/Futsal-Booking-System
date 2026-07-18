import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFutsalForAdmin, getActiveVenueQuery } from '../src/utils/adminDashboardData.js';

test('normalizeFutsalForAdmin exposes the real venue address for the admin dashboard', () => {
  const result = normalizeFutsalForAdmin(
    {
      _id: 'venue-1',
      name: 'Arena One',
      location: { address: 'Kathmandu, Nepal' },
      owner: { name: 'Ramesh' },
    },
    5,
  );

  assert.equal(result.address, 'Kathmandu, Nepal');
  assert.equal(result.bookingCount, 5);
  assert.equal(result.owner.name, 'Ramesh');
});

test('getActiveVenueQuery only returns approved and active venues', () => {
  const query = getActiveVenueQuery();

  assert.deepEqual(query, {
    approvalStatus: 'APPROVED',
    isActive: true,
  });
});
