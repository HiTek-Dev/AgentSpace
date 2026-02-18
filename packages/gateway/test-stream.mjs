import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getKey } from '@tek/cli/vault';

const key = getKey('anthropic');
console.log('Key found:', !!key);
const provider = createAnthropic({ apiKey: key });
console.log('Provider created');

const result = streamText({
  model: provider('claude-sonnet-4-5-20250514'),
  messages: [{ role: 'user', content: 'Say hello in 5 words' }],
});

console.log('Stream started');
try {
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n--- Stream done ---');
  const usage = await result.usage;
  console.log('Usage:', JSON.stringify(usage));
} catch (e) {
  console.error('Stream error:', e.message);
  if (e.cause) console.error('Cause:', e.cause);
  if (e.responseBody) console.error('Response body:', e.responseBody);
}
