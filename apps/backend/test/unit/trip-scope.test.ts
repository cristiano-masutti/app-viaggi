import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { tripScope } from '../../src/modules/trips/trip-access.js';

describe('tripScope', () => {
  it('refuses to start with a route that is not inside a trip', async () => {
    const app = Fastify();

    await expect(
      tripScope(app, async (scope) => {
        scope.get('/api/assets/:assetId', async () => ({}));
      }),
    ).rejects.toThrow('Route GET /api/assets/:assetId is in the trip scope but has no :tripId');
  });
});
