export function verifyApiKey(apiKey: string | undefined): apiKey is string {
  if (!apiKey?.trim()) {
    console.error('No OpenRouter API key found. Add OPENROUTER_API_KEY to the .env file');
    return false;
  }

  return true;
}
