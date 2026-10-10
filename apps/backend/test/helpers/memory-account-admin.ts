import { randomUUID } from 'node:crypto';

import {
  type AccountAdmin,
  AccountAdminError,
  AccountExistsError,
  type NewAccount,
} from '../../src/auth/account-admin.js';

/** Supabase Auth in memoria: gli account creati restano ispezionabili dai test. */
export class InMemoryAccountAdmin implements AccountAdmin {
  readonly accounts = new Map<string, NewAccount & { id: string }>();
  /** Il prossimo `createAccount` fallisce come se Supabase non rispondesse. */
  failNext = false;

  async createAccount(account: NewAccount) {
    if (this.failNext) {
      this.failNext = false;
      throw new AccountAdminError('Service unavailable');
    }
    if (this.accounts.has(account.email)) throw new AccountExistsError();
    const id = randomUUID();
    this.accounts.set(account.email, { ...account, id });
    return { id, email: account.email };
  }
}
