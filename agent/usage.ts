function add(total: number | null, value: unknown) {
  return total !== null &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0
    ? total + value
    : null;
}
export function createUsageMeter(fetcher: typeof fetch = globalThis.fetch) {
  let requests = 0;
  let cost: number | null = 0;
  let input_tokens: number | null = 0;
  let output_tokens: number | null = 0;
  const meteredFetch: typeof fetch = async (input, init) => {
    const response = await fetcher(input, init);
    requests++;
    let usage: Record<string, unknown> = {};
    try {
      const body: unknown = await response.clone().json();
      if (
        typeof body === 'object' &&
        body !== null &&
        'usage' in body &&
        typeof body.usage === 'object' &&
        body.usage !== null
      )
        usage = body.usage as Record<string, unknown>;
    } catch {
      /* Missing usage remains unknown, including error responses. */
    }
    cost = add(cost, usage.cost);
    input_tokens = add(input_tokens, usage.prompt_tokens);
    output_tokens = add(output_tokens, usage.completion_tokens);
    return response;
  };
  return {
    fetch: meteredFetch,
    totals: () => ({ requests, cost, input_tokens, output_tokens }),
  };
}
