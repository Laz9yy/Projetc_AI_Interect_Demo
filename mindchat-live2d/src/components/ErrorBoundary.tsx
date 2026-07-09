import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0A0A1A] text-white">
            <span className="text-4xl mb-4">⚠️</span>
            <p className="text-lg mb-2">页面渲染异常</p>
            <p className="text-white/40 text-sm max-w-md text-center mb-4 px-4">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-colors text-sm"
            >
              重新加载
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
