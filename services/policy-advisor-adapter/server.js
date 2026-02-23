'use strict';

const fastify = require('fastify')({ logger: true });
const axios = require('axios');

const FOUNDRY_URL = process.env.FOUNDRY_URL;
const FOUNDRY_API_KEY = process.env.AZURE_AI_FOUNDRY_API_KEY;

fastify.post('/chat/completions', async (req, reply) => {
  const correlationId = req.headers['x-correlation-id'] || 'c-unknown';
  reply.header('x-correlation-id', correlationId);

  try {
    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return reply.code(400).send({
        error: 'Invalid messages format'
      });
    }

    // Combine full conversation for context
    const conversation = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const foundryResponse = await axios.post(
      FOUNDRY_URL,
      { input: conversation },
      {
        headers: {
          'api-key': FOUNDRY_API_KEY,
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        timeout: 15000
      }
    );

    const assistantText =
      foundryResponse.data?.output?.[0]?.content?.[0]?.text || '';

    return reply.code(200).send({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: assistantText
          },
          finish_reason: 'stop'
        }
      ]
    });

  } catch (err) {
    fastify.log.error(err.response?.data || err.message);

    return reply.code(500).send({
      error: 'Foundry agent call failed'
    });
  }
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

const port = process.env.PORT ? Number(process.env.PORT) : 3004;

fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`Policy Advisor adapter listening on ${port}`))
  .catch(err => {
    fastify.log.error(err);
    process.exit(1);
  });