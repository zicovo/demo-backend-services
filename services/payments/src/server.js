'use strict';

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/cors'), { origin: true });

// In-memory storage: customer_id -> direct debit record
const directDebitStore = new Map();

fastify.post('/payments/direct-debit', async (req, reply) => {
  const cid = req.headers['x-correlation-id'] || 'c-unknown';
  reply.header('x-correlation-id', cid);

  // APIM enforces x-verification-token; backend can double-check too
  const vtok = req.headers['x-verification-token'];
  if (!vtok) {
    return reply.code(403).send({ code: 'verification_required', message: 'Identity verification token is required.' });
  }

  const { customer_id, iban, mandate_reference } = req.body || {};
  if (!customer_id || !iban || !mandate_reference) {
    return reply.code(400).send({ code: 'bad_request', message: 'customer_id, iban, mandate_reference are required' });
  }

  const record = {
    customer_id,
    iban,
    mandate_reference,
    updated_at: new Date().toISOString()
  };

  directDebitStore.set(customer_id, record);

  return reply.code(200).send({
    status: 'success',
    updated_at: record.updated_at
  });
});

fastify.get('/payments/direct-debit/:customer_id', async (req, reply) => {
  const cid = req.headers['x-correlation-id'] || 'c-unknown';
  reply.header('x-correlation-id', cid);

  const customer_id = req.params.customer_id;
  const record = directDebitStore.get(customer_id);

  if (!record) {
    return reply.code(404).send({ code: 'not_found', message: 'No direct debit record found for this customer.' });
  }

  return reply.code(200).send(record);
});

const port = process.env.PORT ? Number(process.env.PORT) : 3002;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`Payments listening on ${port}`))
  .catch(err => { fastify.log.error(err); process.exit(1); });
