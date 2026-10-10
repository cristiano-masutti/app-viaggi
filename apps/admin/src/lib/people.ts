/** "Sofia Marchi"; chi non ha ancora completato il profilo resta riconoscibile. */
export function fullName(person: { firstName: string; lastName: string; email?: string | null }) {
  const name = `${person.firstName} ${person.lastName}`.trim();
  return name || person.email || 'Senza nome';
}

/** Le iniziali dell'avatar: "SM". */
export function initials(person: { firstName: string; lastName: string; email?: string | null }) {
  const letters = `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.trim();
  return (letters || person.email?.charAt(0) || '?').toUpperCase();
}

export const ROLE_LABELS = { coordinator: 'Coordinatore', traveller: 'Viaggiatore' } as const;
