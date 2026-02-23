'use strict';

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/cors'), { origin: true });

// Use Azure CLI login inside container (via mounted ~/.azure)
const { AzureCliCredential } = require('@azure/identity');

const credential = new AzureCliCredential();

// Hardcode your Foundry project endpoint + app name
const AZURE_EXISTING_AIPROJECT_ENDPOINT =
  'https://agentic-demo-webinar-resource.services.ai.azure.com/api/projects/agentic-demo-webinar';

const AGENT_APP_NAME = 'policy-advisor';
const API_VERSION = '2025-11-15-preview';

const FOUNDRY_RESPONSES_URL =
  `${AZURE_EXISTING_AIPROJECT_ENDPOINT}/applications/${AGENT_APP_NAME}/protocols/openai/responses?api-version=${API_VERSION}`;

// Token scope for Azure AI (Foundry is under Cognitive Services auth)
const SCOPE = 'https://cognitiveservices.azure.com/.default';

// Basic token cache (avoid fetching every request)
let cachedToken = null;
let cachedTokenExpiryMs = 0;

async function getBearerToken() {
  const now = Date.now();
  if (cachedToken && now < (cachedTokenExpiryMs - 60_000)) return cachedToken;

  const token = await credential.getToken(SCOPE);
  if (!token || !token.token) {
    throw new Error('Failed to acquire token using AzureCliCredential. Ensure az login was done on the host and ~/.azure is mounted.');
  }

  cachedToken = token.token;
  cachedTokenExpiryMs = token.expiresOnTimestamp || (now + 10 * 60_000);
  return cachedToken;
}

function messagesToConversation(messages) {
  return (messages || [])
    .map(m => `${String(m.role || '').toUpperCase()}: ${String(m.content || '')}`)
    .join('\n');
}

fastify.get('/health', async () => ({ status: 'ok' }));

fastify.post('/chat/completions', async (req, reply) => {
  const correlationId = req.headers['x-correlation-id'] || `c-${Date.now()}`;
  reply.header('x-correlation-id', correlationId);

  const body = req.body || {};
  const messages = body.messages;

  if (!Array.isArray(messages)) {
    return reply.code(400).send({ error: 'Invalid request: body.messages must be an array' });
  }

  const conversation = messagesToConversation(messages);

  try {
    const token = await getBearerToken();

    const resp = await fetch(FOUNDRY_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId
      },
      body: JSON.stringify({
        input: conversation,
        stream: false
      })
    });

    const text = await resp.text();

    if (!resp.ok) {
      req.log.error({ status: resp.status, body: text }, 'Foundry call failed');
      return reply.code(502).send({
        error: 'Foundry agent call failed',
        status: resp.status,
        details: text
      });
    }

    const data = JSON.parse(text);
    const assistantText = data?.output?.[0]?.content?.[0]?.text ?? '';

    return reply.code(200).send({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: assistantText },
          finish_reason: 'stop'
        }
      ]
    });
  } catch (err) {
    req.log.error(err, 'Adapter error');
    return reply.code(500).send({
      error: 'Adapter failed',
      details: String(err?.message || err)
    });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3004;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`Policy Advisor adapter listening on ${port}`))
  .catch(err => { fastify.log.error(err); process.exit(1); });