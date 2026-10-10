/**
 * I test girano sempre nel fuso italiano: le date del viaggio sono locali, e
 * in UTC (il fuso della CI) il cambio dell'ora legale non verrebbe mai provato.
 */
module.exports = () => {
  process.env.TZ = 'Europe/Rome';
};
