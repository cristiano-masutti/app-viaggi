/**
 * Id locali per le entità create nel prototipo.
 * Quando arriverà il backend sarà lui a emettere gli id: qui serve solo
 * qualcosa di stabile e unico dentro la sessione.
 */
let counter = 0;

export const createId = (prefix: string) => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
};
