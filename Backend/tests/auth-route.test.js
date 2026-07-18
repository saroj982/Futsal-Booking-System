import test from 'node:test';
import assert from 'node:assert/strict';
import authRouter from '../src/routes/auth.js';

test('auth router can be imported without missing controller modules', () => {
  assert.ok(authRouter);
  assert.ok(Array.isArray(authRouter.stack));
});
