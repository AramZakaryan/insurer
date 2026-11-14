export function verifyApiKey(apiKey) {
  if (!apiKey) {
    console.error('No OpenRouter API key found. Add OPENROUTER_API_KEY to the .env file');
    return false;
  }

  console.log('OpenRouter API key found');
  return true;
}
