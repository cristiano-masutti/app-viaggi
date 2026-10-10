import { describe, expect, it } from 'vitest';

import { fullName, initials } from './people';

describe('people', () => {
  it('names someone who has not filled in the profile yet by the email', () => {
    expect(fullName({ firstName: 'Sofia', lastName: 'Marchi' })).toBe('Sofia Marchi');
    expect(fullName({ firstName: '', lastName: '', email: 'hana@example.test' })).toBe('hana@example.test');
    expect(fullName({ firstName: '', lastName: '' })).toBe('Senza nome');
  });

  it('makes avatar initials', () => {
    expect(initials({ firstName: 'sofia', lastName: 'marchi' })).toBe('SM');
    expect(initials({ firstName: '', lastName: '', email: 'hana@example.test' })).toBe('H');
  });
});
