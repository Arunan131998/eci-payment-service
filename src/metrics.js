const client = require('prom-client');

client.collectDefaultMetrics();

const paymentsFailedTotal = new client.Counter({
  name: 'payments_failed_total',
  help: 'Total number of failed payments'
});

module.exports = {
  register: client.register,
  paymentsFailedTotal
};
