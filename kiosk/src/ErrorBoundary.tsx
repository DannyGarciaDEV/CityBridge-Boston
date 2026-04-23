import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { err: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  override componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("CityBridge UI error:", err, info.componentStack);
  }

  override render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen bg-zinc-100 px-4 py-16 text-zinc-900">
          <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-red-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-zinc-700">Please refresh the page. If it keeps happening, try again later.</p>
            <button
              type="button"
              className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
