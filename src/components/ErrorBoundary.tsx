import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@lark-apaas/client-toolkit-lite';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // eslint-disable-next-line no-console
    logger.error('[ErrorBoundary] 捕获到渲染错误:', { error: error, errorInfo: errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleBack = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onBack) {
      this.props.onBack();
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle = '页面渲染出错了' } = this.props;
      const err = this.state.error;
      return (
        <div className="flex flex-1 min-h-0 w-full items-center justify-center overflow-auto p-6">
          <div className="w-full max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground">{fallbackTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  很抱歉，该页面在渲染时遇到了问题。您可以尝试刷新或返回上一页。
                </p>
              </div>
            </div>

            {/* 错误详情 */}
            {err && (
              <div className="mt-4 rounded-md border border-border bg-background/80 p-3">
                <div className="mb-1 text-xs font-medium text-foreground/70">错误信息</div>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-destructive/90">
                  {err.message || String(err)}
                </pre>
                {err.stack && (
                  <>
                    <div className="mt-3 mb-1 text-xs font-medium text-foreground/70">调用堆栈</div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground/80">
                      {err.stack}
                    </pre>
                  </>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={this.handleBack}>
                <ArrowLeft className="size-3.5" />
                返回上一页
              </Button>
              <Button size="sm" className="gap-1.5" onClick={this.handleRetry}>
                <RefreshCw className="size-3.5" />
                重试
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
