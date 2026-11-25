// Minimal fetch clients. Keys only from the environment. Returns { text, outTokens, ms }.
// Loaded only by a real run, never by --fake or --estimate.
const post = async (url, headers, body) => {
  const t = Date.now(); const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} ${r.status}`); return [await r.json(), Date.now() - t];
};
export const PROVIDERS = {
  anthropic: async (model, system, messages, max = 4000) => {
    const [j, ms] = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, { model, system, messages, max_tokens: max });
    return { text: j.content.map((c) => c.text ?? '').join(''), outTokens: j.usage.output_tokens, ms };
  },
  openai: async (model, system, messages, max = 4000) => {
    const [j, ms] = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, { model, messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: max });
    return { text: j.choices[0].message.content ?? '', outTokens: j.usage.completion_tokens, ms };
  },
  gemini: async (model, system, messages, max = 4000) => {
    const [j, ms] = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': process.env.GEMINI_API_KEY },
      { systemInstruction: { parts: [{ text: system }] }, contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: max } });
    return { text: j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '', outTokens: j.usageMetadata?.candidatesTokenCount ?? 0, ms };
  },
};
