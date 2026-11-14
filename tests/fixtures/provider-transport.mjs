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
  const collaborationFailures = new Set();
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
    if (content.task?.stage) {
      const provider = url.hostname === 'api.openai.com' ? 'openai' : 'anthropic';
      const { stage, question } = content.task;
      const failureKey = question + provider + stage;
      if (stage === 'review' && !content.otherAnalysis)
        throw new Error('Mock cross-review did not receive the peer analysis');
      if (
        stage === 'synthesis' &&
        (content.analyses?.length !== 2 || content.reviews?.length !== 2)
      )
        throw new Error('Mock synthesis did not receive both analyses/reviews');
      if (
        provider === 'anthropic' &&
        question.includes('[TEST UNCERTAIN]') &&
        !collaborationFailures.has(failureKey)
      ) {
        collaborationFailures.add(failureKey);
        throw new Error('Isolated interrupted mock request');
      }
      if (
        provider === 'anthropic' &&
        question.includes('[TEST RATE LIMIT]') &&
        !collaborationFailures.has(failureKey)
      ) {
        collaborationFailures.add(failureKey);
        return Response.json({ error: 'MOCK rate limit' }, { status: 429 });
      }
      if (question.includes('[TEST SLOW]'))
        await new Promise((resolve) => setTimeout(resolve, 1800));
      text = JSON.stringify({
        groundedClaims: content.sources.length
          ? [
              {
                text: `[MOCK ${provider} ${stage}] The original records the notebook location.`,
                citations: [{ source: 1, quote: content.sources[0].excerpt.slice(0, 120) }],
              },
            ]
          : [],
        interpretations: ['[MOCK] Current location is not independently verified.'],
        agreements: ['[MOCK] Both responses refer to the historical source.'],
        disagreements: [`[MOCK ${stage}] The historical source does not resolve present location.`],
        uncertainty: ['[MOCK] Check the present location before relying on it.'],
      });
    } else if (content.passages) {
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
