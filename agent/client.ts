export function createClient(baseUrl: string, signal: AbortSignal) {
  return async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(new URL(path, baseUrl), {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    const result: unknown = await response.json();
    if (!response.ok)
      throw new Error(
        typeof result === 'object' && result !== null && 'error' in result
          ? String(result.error)
          : `Backend returned ${response.status}.`,
      );
    return result as T;
  };
}
