import type { UserProfile } from '@/types';

/** Utente loggato del prototipo. Il login accetta qualsiasi credenziale. */
export const MOCK_PROFILE: UserProfile = {
  id: 'u-marco',
  firstName: 'Marco',
  lastName: 'Rossi',
  username: '@marcorossi',
  avatar: 'https://i.pravatar.cc/300?img=68',
  bio: 'Sveglia presto, ultimo a dormire. Cerco strade secondarie, cibo di strada e gente del posto da far parlare. In viaggio porto sempre una macchina analogica e troppe calze.',
  passport: {
    number: 'YA9182773',
    expiry: '04/2029',
    photoUri: 'https://images.unsplash.com/photo-1544185310-0b3cf501672a?w=1400&q=80',
  },
  fiscalCode: 'RSSMRC88T10H501K',
  diet: 'Onnivoro, niente frutti di mare crudi.',
  medicalNotes: 'Allergia alle arachidi: porto un EpiPen nello zaino. Nessun farmaco quotidiano.',
  biometricUnlock: true,
};

/** Limite della bio libera, condiviso tra ProfileScreen e il contatore a schermo. */
export const BIO_MAX_LENGTH = 300;
