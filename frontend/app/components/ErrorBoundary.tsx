'use client';

import { Component, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="bg-surface-container-lowest text-on-surface min-h-screen p-space-lg flex items-center justify-center">
          <div className="text-center max-w-md">
            <span className="material-symbols-outlined text-error text-[48px]" aria-hidden="true">error</span>
            <h2 className="mt-space-md font-headline-md text-headline-md text-on-surface">Something went wrong</h2>
            <p className="mt-space-sm font-body-md text-body-md text-on-surface-variant">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mt-space-lg text-left bg-surface-container-low p-space-md rounded-sm border border-outline/30">
                <summary className="font-label-sm text-label-sm text-outline cursor-pointer">Error details</summary>
                <pre className="mt-space-sm font-tabular-data-md text-tabular-data-md text-error overflow-auto max-h-64">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-space-lg py-1.5 px-space-md rounded-md font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container transition-colors border border-transparent"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}