import { describe, expect, it } from 'vitest';

import { pageFromParams, pageParam, withParams } from './searchParams';

describe('search params', () => {
  it('sets, keeps and removes parameters', () => {
    const params = new URLSearchParams('stato=past&q=islanda&pagina=3');
    const next = withParams(params, { stato: 'upcoming', q: '', pagina: undefined });
    expect(next.toString()).toBe('stato=upcoming&pagina=3');
  });

  it('shows pages from 1 and counts them from 0', () => {
    expect(pageFromParams(new URLSearchParams('pagina=3'))).toBe(2);
    expect(pageFromParams(new URLSearchParams('pagina=nope'))).toBe(0);
    for (const odd of ['2.01', '-3', '0', '1e3', '999999']) {
      expect(pageFromParams(new URLSearchParams(`pagina=${odd}`))).toBe(0);
    }
    expect(pageFromParams(new URLSearchParams(''))).toBe(0);
    expect(pageParam(0)).toBeNull();
    expect(pageParam(2)).toBe('3');
    expect(pageParam(undefined)).toBeUndefined();
  });
});
