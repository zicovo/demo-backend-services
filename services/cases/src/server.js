'use strict';

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/cors'), { origin: true });

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
  return reply.code(201).send({ case_id: `case-${caseCounter}`, status: 'opened' });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3003;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`Cases listening on ${port}`))
  .catch(err => { fastify.log.error(err); process.exit(1); });
