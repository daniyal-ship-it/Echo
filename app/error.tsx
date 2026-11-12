'use client';
import { useEffect } from 'react';

// Route-level fallback in ECHO's own language, shown instead of the framework's blank
// "This page couldn't load" screen when rendering fails outside a section boundary.
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  // A value thrown in a Client Component is passed as-is and may not be an Error.
  const message = error instanceof Error ? error.message : String(error);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    console.error('[ECHO] workspace failed to render', error);
  }, [error]);
  return (
    <main className="route-fault" role="alert">
      <span className="eyebrow">ECHO · DISPLAY FAULT</span>
      <h1>The workspace could not be drawn</h1>
      <p>Nothing was deleted or changed. This is a display problem, not a loss of your memories.</p>
      <p className="fine-print">
        Technical detail: {message || 'No message was provided.'}
        {digest ? ` · reference ${digest}` : ''}
      </p>
      <div className="row">
        <button className="button primary" onClick={() => retry()}>
          Try again
        </button>
        <button className="button secondary" onClick={() => window.location.reload()}>
          Reload ECHO
        </button>
      </div>
    </main>
  );
}
