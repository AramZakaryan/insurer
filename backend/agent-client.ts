import { ApiError } from './store.ts';

export function createAgentDispatcher(agentUrl: string) {
  const endpoint = new URL('/runs', agentUrl);
  return async (claimId: string, threadId: string): Promise<void> => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, thread_id: threadId }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      throw new ApiError(503, 'Agent service is unavailable.');
    });
    await response.body?.cancel();
    if (response.status !== 202)
      throw new ApiError(502, 'Agent service rejected the run.');
  };
}
