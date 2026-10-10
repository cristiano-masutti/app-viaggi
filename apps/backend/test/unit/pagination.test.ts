import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor } from '../../src/lib/pagination.js';

describe('cursors', () => {
  it('round-trips the position in the list', () => {
    const position = {
      createdAt: new Date('2026-09-16T18:42:00.123Z'),
      id: '7f1c2a8e-0d6b-4f5e-9a3c-1b2d3e4f5a6b',
    };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it.each([
    '',
    'garbage',
    Buffer.from('not-a-date|id').toString('base64url'),
    Buffer.from('2026-01-01T00:00:00Z').toString('base64url'),
  ])('rejects the malformed cursor %j', (cursor) => {
    expect(() => decodeCursor(cursor)).toThrowError(/cursor/);
  });
});
