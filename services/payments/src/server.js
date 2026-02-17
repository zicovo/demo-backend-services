'use strict';

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/cors'), { origin: true });

fastify.post('/payments/direct-debit', async (req, reply) => {
  const cid = req.headers['x-correlation-id'] || 'c-unknown';
  reply.header('x-correlation-id', cid);

  // NOTE: APIM enforces x-verification-token, but backend can double-check too
  const vtok = req.headers['x-verification-token'];
  if (!vtok) {
    return reply.code(403).send({ code: 'verification_required', message: 'Identity verification token is required.' });
  }

  const { customer_id, iban, mandate_reference } = req.body || {};
  if (!customer_id || !iban || !mandate_reference) {
    return reply.code(400).send({ code: 'bad_request', message: 'customer_id, iban, mandate_reference are required' });
  }

  return reply.code(200).send({
    status: 'success',
    updated_at: new Date().toISOString()
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3002;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`Payments listening on ${port}`))
  .catch(err => { fastify.log.error(err); process.exit(1); });
