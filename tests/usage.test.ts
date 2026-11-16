import assert from 'node:assert/strict';
import test from 'node:test';
import { createUsageMeter } from '../agent/usage.ts';

test('OpenRouter usage is accumulated without consuming the SDK response', async () => {
  const meter = createUsageMeter(async () =>
    Response.json({
      usage: { cost: 0.01, prompt_tokens: 10, completion_tokens: 5 },
    }),
  );
  const response = await meter.fetch('https://unused.test');
  assert.equal((await response.json()).usage.cost, 0.01);
  await meter.fetch('https://unused.test');
  assert.deepEqual(meter.totals(), {
    requests: 2,
    cost: 0.02,
    input_tokens: 20,
    output_tokens: 10,
  });
});
test('omitted billing data remains unknown across subsequent attempts', async () => {
  let calls = 0;
  const meter = createUsageMeter(async () =>
    Response.json({
      usage: calls++
        ? { cost: 0.01, prompt_tokens: 10, completion_tokens: 5 }
        : { prompt_tokens: 10, completion_tokens: 5 },
    }),
  );
  await meter.fetch('https://unused.test');
  await meter.fetch('https://unused.test');
  assert.equal(meter.totals().cost, null);
  assert.equal(meter.totals().input_tokens, 20);
});
