import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../lib/logger';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('React Error Boundary Caught Error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] p-6">
          <div className="max-w-md w-full bg-white border border-[#141414] shadow-[8px_8px_0px_0px_#141414] p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-8">
              An unexpected error occurred. Our team has been notified.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#141414] text-white py-3 px-6 rounded-md font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#2a2a2a] transition-all active:scale-95"
            >
              <RotateCcw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
