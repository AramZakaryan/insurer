import { openrouter } from './index.js';

const messages = [
  { role: 'system', content: 'You are a helpful assistant who answers in the style of a pirate.' },
  { role: 'user', content: 'What is the meaning of the universe?' },
];

try {
  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-6-luna',
    messages,
  });

  const answer = response.choices[0]?.message.content;
  if (!answer?.trim()) {
    throw new Error('No text answer returned by the model.');
  }

  console.log(answer);
} catch (error) {
  console.error(`OpenRouter request failed: ${error.message}`);
  process.exitCode = 1;
}
