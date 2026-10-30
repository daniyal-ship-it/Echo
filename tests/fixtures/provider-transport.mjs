// Explicit mock transport loaded ONLY by the isolated Playwright server.
// Production code contains no mock endpoint, provider URL override or fake-vector fallback.
if (process.env.ECHO_MOCK_PROVIDER_TRANSPORT === 'isolated-browser-tests') {
  if (
    process.env.DATABASE_URL ||
    process.env.VERCEL ||
    process.env.APP_ORIGIN !== 'http://127.0.0.1:3100' ||
    !process.env.ECHO_DATA_DIR?.startsWith('/tmp/echo-browser-')
  )
    throw new Error('Mock transport requires the isolated local browser database.');
  if (
    [
      process.env.ECHO_OPENAI_API_KEY,
      process.env.OPENAI_API_KEY,
      process.env.ECHO_ANTHROPIC_API_KEY,
      process.env.ANTHROPIC_API_KEY,
    ].some((key) => key && key !== 'MOCK-ONLY-NOT-A-CREDENTIAL')
  )
    throw new Error('Live credentials are forbidden in mock browser tests.');
  process.env.ECHO_OPENAI_API_KEY = 'MOCK-ONLY-NOT-A-CREDENTIAL';
  process.env.ECHO_ANTHROPIC_API_KEY = 'MOCK-ONLY-NOT-A-CREDENTIAL';
  process.env.ECHO_OPENAI_MODEL = 'mock-openai-model';
  process.env.ECHO_ANTHROPIC_MODEL = 'mock-anthropic-model';
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (!['api.openai.com', 'api.anthropic.com'].includes(url.hostname))
      return fetchReal(input, init);
    if (url.pathname.startsWith('/v1/models/'))
      return Response.json({ id: decodeURIComponent(url.pathname.split('/').at(-1)) });
    const data = JSON.parse(String(init.body));
    if (url.pathname === '/v1/embeddings')
      return Response.json({
        model: data.model,
        data: data.input.map((text, index) => ({
          index,
          embedding: Array.from({ length: 1536 }, (_, i) =>
            i ===
            (/access codes|credentials|secured|sealed envelope/i.test(text)
              ? 0
              : /spacecraft/i.test(text)
                ? 2
                : 1)
              ? 1
              : 0,
          ),
        })),
        usage: { total_tokens: 25 },
      });
    const content = JSON.parse(data.input || data.messages[0].content);
    let text;
    if (content.passages) {
      const passage = content.passages[0];
      text = JSON.stringify({
        summary: [
          {
            text: '[MOCK PROVIDER] The access codes were stored in a sealed envelope inside the desk.',
            citations: [{ chunkId: passage.id, quote: passage.text.slice(0, 120) }],
          },
        ],
        insights: [],
      });
    } else
      text =
        '[MOCK PROVIDER] Retrieved evidence: the access codes were stored in a sealed envelope inside the desk [1].';
    return Response.json(
      url.hostname === 'api.openai.com'
        ? {
            output: [{ content: [{ type: 'output_text', text }] }],
            usage: { input_tokens: 80, output_tokens: 50 },
          }
        : { content: [{ type: 'text', text }], usage: { input_tokens: 80, output_tokens: 50 } },
    );
  };
}
