'use strict';

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/cors'), { origin: true });

function getCorrelationId(req) {
  return req.headers['x-correlation-id'] || (req.body && req.body.correlation_id) || 'c-unknown';
}

fastify.post('/idv/verify', async (req, reply) => {
  const cid = getCorrelationId(req);
  reply.header('x-correlation-id', cid);

  // ── Request logging ──────────────────────────────────────────────
  req.log.info({
    event: 'idv_request_received',
    correlation_id: cid,
    headers: {
      'content-type': req.headers['content-type'],
      'x-correlation-id': req.headers['x-correlation-id'],
    },
    body: req.body,
    raw_body_type: typeof req.body,
  }, `[IDV] Request received — correlation_id=${cid}`);

  const { customer_id, factors } = req.body || {};

  if (!customer_id || !factors) {
    req.log.warn({
      event: 'idv_bad_request',
      correlation_id: cid,
      has_customer_id: !!customer_id,
      has_factors: !!factors,
      body_keys: req.body ? Object.keys(req.body) : 'null',
    }, `[IDV] 400 Bad Request — missing customer_id or factors`);
    return reply.code(400).send({ code: 'bad_request', message: 'customer_id and factors are required' });
  }

  // ── Decision logic with detailed logging ──────────────────────────
  const otpOk = factors.otp === '123456';
  const kbvOk = typeof factors.kbv_score === 'number' && factors.kbv_score >= 0.8;

  req.log.info({
    event: 'idv_evaluation',
    correlation_id: cid,
    customer_id,
    factors_received: {
      otp: factors.otp ? `${factors.otp.substring(0, 2)}****` : null,
      otp_type: typeof factors.otp,
      otp_match: otpOk,
      kbv_score: factors.kbv_score,
      kbv_type: typeof factors.kbv_score,
      kbv_pass: kbvOk,
      device_trust: factors.device_trust,
    },
  }, `[IDV] Evaluating — customer=${customer_id} otp_ok=${otpOk} kbv_ok=${kbvOk}`);

  const verified = otpOk || kbvOk;
  const identity_confidence = verified ? 0.93 : 0.42;
  const verification_token = verified ? `vtok_${customer_id}_ok` : `vtok_${customer_id}_fail`;

  const response = { verified, identity_confidence, verification_token };

  // ── Response logging ─────────────────────────────────────────────
  req.log.info({
    event: 'idv_result',
    correlation_id: cid,
    customer_id,
    verified,
    identity_confidence,
    decision_reason: verified
      ? (otpOk ? 'otp_match' : 'kbv_score_sufficient')
      : `otp_${factors.otp === null ? 'null' : 'mismatch'}_kbv_${factors.kbv_score ?? 'null'}_below_0.8`,
  }, `[IDV] Result — customer=${customer_id} verified=${verified} confidence=${identity_confidence}`);

  return reply.code(200).send(response);
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`IDV listening on ${port}`))
  .catch(err => { fastify.log.error(err); process.exit(1); });
