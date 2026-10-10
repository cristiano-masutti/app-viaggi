import { randomInt } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

/**
 * Gli account li crea l'organizzazione, non le persone: l'app non ha una
 * registrazione autonoma. Il pannello di controllo passa da qui, con la
 * service role key di Supabase, che resta solo sul server.
 */
export interface NewAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AccountAdmin {
  /** Crea l'account su Supabase Auth, con l'email già confermata. */
  createAccount(account: NewAccount): Promise<{ id: string; email: string }>;
}

export class AccountExistsError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('An account with this email already exists', options);
    this.name = 'AccountExistsError';
  }
}

export class AccountAdminError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`Account provider error: ${message}`, options);
    this.name = 'AccountAdminError';
  }
}

export function createSupabaseAccountAdmin({
  url,
  serviceRoleKey,
}: {
  url: string;
  serviceRoleKey: string;
}): AccountAdmin {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async createAccount({ email, password, firstName, lastName }) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      });
      if (error) {
        // `email_exists` dalle versioni recenti di GoTrue, `user_already_exists` dalle precedenti.
        if (error.code === 'email_exists' || error.code === 'user_already_exists') {
          throw new AccountExistsError({ cause: error });
        }
        throw new AccountAdminError(error.message, { cause: error });
      }
      return { id: data.user.id, email: data.user.email ?? email };
    },
  };
}

/** Niente caratteri che si confondono quando la password si detta o si ricopia (0/O, 1/l/I). */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Password provvisoria da consegnare alla persona: 4 gruppi da 4 caratteri
 * (`kq7m-vw3p-h9tx-2rnd`, circa 79 bit). Si legge e si detta facilmente, e
 * si genera con il generatore crittografico, mai con `Math.random`.
 */
export function generateTemporaryPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return [group(), group(), group(), group()].join('-');
}
