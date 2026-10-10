import { describe, expect, it } from 'vitest';

import { generateInviteCode, INVITE_CODE_PATTERN } from '../../src/modules/trips/invite-code.js';

describe('generateInviteCode', () => {
  it('starts with a readable slug of the title and ends with 12 random characters', () => {
    expect(generateInviteCode('Islanda On The Road 🇮🇸')).toMatch(/^islanda-on-the-road-[a-z2-9]{12}$/);
  });

  it('turns accents into plain letters', () => {
    expect(generateInviteCode('Perù & Machu Picchu')).toMatch(/^peru-machu-picchu-[a-z2-9]{12}$/);
  });

  it('is only the random part when the title has no usable characters', () => {
    expect(generateInviteCode('🇯🇵🗾')).toMatch(/^[a-z2-9]{12}$/);
  });

  it('keeps the slug short and never ends it with a dash', () => {
    const code = generateInviteCode('Un titolo molto molto lungo per un viaggio');
    expect(code.length).toBeLessThanOrEqual(24 + 1 + 12);
    expect(code).not.toMatch(/--/);
  });

  it('always matches the pattern accepted by the invite routes', () => {
    for (const title of ['Islanda On The Road 🇮🇸', '🇯🇵', 'a'.repeat(120)]) {
      expect(generateInviteCode(title)).toMatch(INVITE_CODE_PATTERN);
    }
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 10_000 }, () => generateInviteCode('Viaggio')));
    expect(codes.size).toBe(10_000);
  });
});
