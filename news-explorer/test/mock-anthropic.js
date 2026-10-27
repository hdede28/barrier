'use strict';

// Anthropic Messages API'nin küçük bir taklidi: gelen JSON dizisindeki her başlığa "TR: " ekleyerek "çevirir".
const http = require('node:http');

function createMockAnthropic({ status = 200, stopReason = 'end_turn', reply } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push({ url: req.url, headers: req.headers, body });
      if (status !== 200) {
        res.writeHead(status, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ type: 'error', error: { type: status === 401 ? 'authentication_error' : 'rate_limit_error', message: 'mock' } }));
      }
      const input = JSON.parse(body.messages[0].content);
      const text = reply ? reply(input) : JSON.stringify(input.map((t) => `TR: ${t}`));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, stop_reason: stopReason, stop_sequence: null,
        content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 },
      }));
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ requests, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

module.exports = { createMockAnthropic };
