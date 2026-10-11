/**
 * Si carica prima del processo (`node --import ./clock.mjs …`): da lì in poi
 * `Date` parte da `E2E_NOW` e scorre normalmente. Così backend e Supabase
 * finto vivono lo stesso giorno del browser (`page.clock`) e del seed.
 */
const target = process.env.E2E_NOW;
if (target) {
  const RealDate = globalThis.Date;
  const offset = RealDate.parse(target) - RealDate.now();
  class E2EDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = E2EDate;
}
