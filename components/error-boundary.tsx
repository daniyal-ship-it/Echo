'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

/** Keeps a rendering fault inside one section instead of replacing the whole workspace. */
export class SectionBoundary extends Component<
  {
    name: string;
    children: ReactNode;
    /** A new value clears a shown fault, e.g. newly loaded data. */ resetKey?: unknown;
    onDismiss?: () => void;
  },
  { error: Error | null; attempt: number }
> {
  state = { error: null as Error | null, attempt: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(previous: { resetKey?: unknown }) {
    if (this.state.error && previous.resetKey !== this.props.resetKey)
      this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ECHO] ${this.props.name} failed to render`, error, info.componentStack);
  }
  render() {
    if (!this.state.error)
      return (
        <div className="section-boundary" key={this.state.attempt}>
          {this.props.children}
        </div>
      );
    return (
      <div className="section-fault" role="alert">
        <TriangleAlert size={18} aria-hidden />
        <div>
          <strong>{this.props.name} could not be displayed</strong>
          <p>Your original and saved data are unchanged. The rest of the workspace still works.</p>
          <p className="fine-print">Technical detail: {this.state.error.message}</p>
          <button
            className="button secondary small"
            onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
          >
            <RotateCcw size={13} aria-hidden />
            Try again
          </button>
          {this.props.onDismiss && (
            <button className="text-button" onClick={this.props.onDismiss}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }
}
