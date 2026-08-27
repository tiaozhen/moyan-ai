import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { loadCreationState, setCurrentArticle, saveCreationState } from '@/lib/storage';
import type { INovelArticle } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const errorBoundaryRef = useRef<ErrorBoundary | null>(null);
  const [article, setArticle] = useState<INovelArticle | null>(null);
  // 路由变化时重置错误边界，允许从错误页切到正常页时重新渲染
  const errorBoundaryKey = location.pathname;

  useEffect(() => {
    const state = loadCreationState();
    const found = state.articles.find((a) => a.id === bookId) || null;
    setArticle(found);
    if (found && state.currentArticleId !== found.id) {
      const next = setCurrentArticle(state, found.id);
      saveCreationState(next);
    }
  }, [bookId]);

  const handleBack = useCallback(() => {
    navigate('/books');
  }, [navigate]);

  const lengthLabel = article ? NOVEL_LENGTH_OPTIONS[article.lengthType]?.label || article.lengthType : '';

  if (!article) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <BookOpen className="mb-4 size-12 text-muted-foreground/40" />
        <h2 className="text-xl font-medium">小说不存在</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          这本小说可能已被删除，或者链接不正确
        </p>
        <Button className="mt-4 gap-2" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          返回书架
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* 页面标题栏 */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回书架
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BookOpen className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">
                {article.title}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] font-normal">
                  {lengthLabel}
                </Badge>
                {article.category && (
                  <span className="truncate">{article.category.name}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex gap-1 px-4 md:px-6 max-w-[1400px]">
          <NavLink
            to={`/books/${bookId}`}
            end
            className={({ isActive }) =>
              `flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <FileText className="size-4" />
            大纲
          </NavLink>
          <NavLink
            to={`/books/${bookId}/editor`}
            className={({ isActive }) =>
              `flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <BookOpen className="size-4" />
            创作
          </NavLink>
        </div>
      </div>

      {/* 子内容区：错误边界包裹，防止子页面渲染崩溃导致白屏 */}
      <div className="flex flex-1 min-h-0 flex-col">
        <ErrorBoundary
          key={errorBoundaryKey}
          fallbackTitle="子页面渲染失败"
          onBack={() => navigate(-1)}
        >
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}
