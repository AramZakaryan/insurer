import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const runNode = promisify(execFile);

test('agent retrieves a policy, records a decision and finishes with low reasoning', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'insurer-agent-'));
  // Isolate dotenv from the real key and intercept every model request.
  const script = `
    import assert from 'node:assert/strict';
    const replies = [
      { content: null, tool_calls: [{ id: 'policy', type: 'function', function: {
        name: 'get_policy', arguments: JSON.stringify({ policy_id: 'POL-2001' })
      } }] },
      { content: null, tool_calls: [{ id: 'record', type: 'function', function: {
        name: 'record_decision', arguments: JSON.stringify({
          claim_id: 'TEST-1', decision: 'approve', payout: 420, rationale: 'Covered by section 3.'
        })
      } }] },
      { content: 'Approved $420.' },
    ];
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'openai/gpt-6-luna');
      assert.equal(body.reasoning_effort, 'low');
      if (calls === 1) {
        const tool = body.messages.find(message => message.role === 'tool');
        assert.equal(JSON.parse(tool.content).policy_id, 'POL-2001');
      }
      if (calls === 2) {
        assert.ok(body.messages.some(message => message.content === 'Recorded approve on TEST-1'));
      }
      const message = replies[calls++];
      assert.ok(message, 'Unexpected extra model request');
      return new Response(JSON.stringify({
        id: 'mock-' + calls, object: 'chat.completion', created: 1, model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', ...message },
          finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      }), { headers: { 'content-type': 'application/json' } });
    };
    const { agent } = await import(${JSON.stringify(new URL('../agent.ts', import.meta.url).href)});
    const { recorded } = await import(${JSON.stringify(new URL('../tools.ts', import.meta.url).href)});
    const { makeClaimPrompt } = await import(${JSON.stringify(new URL('../prompt.ts', import.meta.url).href)});
    const result = await agent.invoke({ messages: [{ role: 'user', content: makeClaimPrompt({
      claim_id: 'TEST-1', policy_id: 'POL-2001', summary: 'Delayed flight',
      story: 'Flight delayed.', claim_type: 'trip_delay', amount_claimed: 420
    }) }] });
    assert.equal(calls, 3);
    assert.equal(result.messages.length, 6);
    assert.equal(result.messages.at(-1).content, 'Approved $420.');
    assert.deepEqual(recorded['TEST-1'], {
      decision: 'approve', payout: 420, rationale: 'Covered by section 3.'
    });
  `;

  try {
    await runNode(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', script], {
      cwd: workspace,
      env: { ...process.env, OPENROUTER_API_KEY: 'test-key' },
      timeout: 20_000,
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
