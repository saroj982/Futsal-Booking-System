import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicFutsalQuery } from '../src/controllers/futsalController.js';

test('buildPublicFutsalQuery keeps approval filters for keyword searches', () => {
  const query = buildPublicFutsalQuery({ keyword: 'arena' });

  assert.deepEqual(query, {
    $and: [
      { approvalStatus: 'APPROVED' },
      { isActive: true },
      {
        $or: [
          { name: { $regex: 'arena', $options: 'i' } },
          { 'location.address': { $regex: 'arena', $options: 'i' } },
        ],
      },
    ],
  });
});

test('buildPublicFutsalQuery combines geo filters with approval filters', () => {
  const query = buildPublicFutsalQuery({ lat: 27.7, lng: 85.3, radius: 15 });

  assert.equal(query.$and[0].approvalStatus, 'APPROVED');
  assert.equal(query.$and[1].isActive, true);
  assert.ok(query.$and[2].location.$near);
  assert.equal(query.$and[2].location.$near.$maxDistance, 15000);
});
