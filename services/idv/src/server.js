'use strict';

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/cors'), { origin: true });

function getCorrelationId(req) {
  return req.headers['x-correlation-id'] || (req.body && req.body.correlation_id) || 'c-unknown';
}

fastify.post('/idv/verify', async (req, reply) => {
  const cid = getCorrelationId(req);
  reply.header('x-correlation-id', cid);

  const { customer_id, factors } = req.body || {};
  if (!customer_id || !factors) {
    return reply.code(400).send({ code: 'bad_request', message: 'customer_id and factors are required' });
  }

  // Demo logic: if otp == "123456" or kbv_score >= 0.8 => verified
  const otpOk = factors.otp === '123456';
  const kbvOk = typeof factors.kbv_score === 'number' && factors.kbv_score >= 0.8;

  const verified = otpOk || kbvOk;
  const identity_confidence = verified ? 0.93 : 0.42;

  // Deterministic token for demo
  const verification_token = verified ? `vtok_${customer_id}_ok` : `vtok_${customer_id}_fail`;

  return reply.code(200).send({ verified, identity_confidence, verification_token });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`IDV listening on ${port}`))
  .catch(err => { fastify.log.error(err); process.exit(1); });
