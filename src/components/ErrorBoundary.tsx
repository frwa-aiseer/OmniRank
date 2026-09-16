import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[OmniRank Uncaught Error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div id="error-boundary-container" className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
          <div id="error-card" className="max-w-md w-full bg-white rounded-xl border border-neutral-200 shadow-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-neutral-900">Something went wrong</h2>
              <p className="text-sm text-neutral-600">
                An unexpected error occurred while rendering this view.
              </p>
            </div>
            {this.state.error?.message && (
              <pre className="text-xs bg-neutral-100 text-neutral-700 p-3 rounded-lg overflow-x-auto text-left font-mono border border-neutral-200">
                {this.state.error.message}
              </pre>
            )}
            <button
              id="error-reload-btn"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
