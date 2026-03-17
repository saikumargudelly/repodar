"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center flex flex-col justify-center items-center text-slate-400">
          <h2 className="text-xl text-red-500 font-semibold mb-2">Something went wrong</h2>
          <p className="mb-4 text-sm max-w-sm">
            An unexpected error occurred in this view.
          </p>
          <button 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md transition duration-200"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
