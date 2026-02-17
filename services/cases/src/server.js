'use strict';

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/cors'), { origin: true });

// In-memory storage: case_id -> case record
const caseStore = new Map();
let caseCounter = 10000;

fastify.post('/cases/disputes', async (req, reply) => {
  const cid = req.headers['x-correlation-id'] || 'c-unknown';
  reply.header('x-correlation-id', cid);

  const { customer_id, transaction_id, amount_eur, reason, eligibility } = req.body || {};
  if (!customer_id || !transaction_id || typeof amount_eur !== 'number' || !reason || !eligibility) {
    return reply.code(400).send({ code: 'bad_request', message: 'missing required fields' });
  }

  if (!eligibility.eligible) {
    return reply.code(403).send({ code: 'policy_violation', message: 'Dispute is not eligible per policy.' });
  }

  caseCounter += 1;
  const case_id = `case-${caseCounter}`;

  const record = {
    case_id,
    status: 'opened',
    created_at: new Date().toISOString(),
    customer_id,
    transaction_id,
    amount_eur,
    reason,
    rules_version: eligibility.rules_version
  };

  caseStore.set(case_id, record);

  return reply.code(201).send({ case_id, status: 'opened' });
});

fastify.get('/cases/:case_id', async (req, reply) => {
  const cid = req.headers['x-correlation-id'] || 'c-unknown';
  reply.header('x-correlation-id', cid);

  const case_id = req.params.case_id;
  const record = caseStore.get(case_id);

  if (!record) {
    return reply.code(404).send({ code: 'not_found', message: 'Case not found.' });
  }

  return reply.code(200).send(record);
});

const port = process.env.PORT ? Number(process.env.PORT) : 3003;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`Cases listening on ${port}`))
  .catch(err => { fastify.log.error(err); process.exit(1); });
