import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.log('NO_KEY'); process.exit(1); }
const model = process.env.XOFFICE_AI_MODEL || 'claude-opus-4-8';
const client = new Anthropic({ apiKey: key });
try {
  const r = await client.messages.create({
    model, max_tokens: 64,
    messages: [{ role: 'user', content: 'Trả lời đúng cụm: "Kết nối X.AI OK".' }],
  });
  const text = r.content.map((b) => b.text || '').join('').trim();
  console.log('OK | model=' + model + ' | reply="' + text + '" | tokens ' + r.usage.input_tokens + '/' + r.usage.output_tokens);
} catch (e) {
  console.log('FAIL | ' + (e.status || '') + ' ' + (e.name || '') + ' | ' + String(e.message).slice(0, 160));
}
