import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Tag,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { INovelArticle, NovelLengthType } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import {
  loadCreationState,
  saveCreationState,
  deleteArticle as deleteArticleFromState,
  setCurrentArticle,
} from '@/lib/storage';

export default function BookListPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<INovelArticle[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    const state = loadCreationState();
    setArticles(state.articles);
  }, []);

  const handleOpenBook = useCallback(
    (articleId: string) => {
      const state = loadCreationState();
      const next = setCurrentArticle(state, articleId);
      saveCreationState(next);
      navigate(`/books/${articleId}`);
    },
    [navigate]
  );

  const handleDelete = useCallback((articleId: string) => {
    setDeleteTargetId(articleId);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTargetId) return;
    const state = loadCreationState();
    const next = deleteArticleFromState(state, deleteTargetId);
    saveCreationState(next);
    setArticles(next.articles);
    toast.success('已删除小说');
    setDeleteTargetId(null);
  }, [deleteTargetId]);

  const deleteTarget = articles.find((a) => a.id === deleteTargetId);

  const getProgress = (article: INovelArticle) => {
    const total = article.chapters.length;
    if (total === 0) return { generated: 0, total: 0, percent: 0 };
    const generated = article.chapters.filter((c) => c.status !== 'unwritten').length;
    return { generated, total, percent: Math.round((generated / total) * 100) };
  };

  const lengthBadge = (t: NovelLengthType) => {
    const map: Record<NovelLengthType, string> = {
      short: '短篇',
      medium: '中篇',
      long: '长篇',
    };
    return map[t] || t;
  };

  const sortedArticles = [...articles].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      {/* 顶部 */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">我的书架</h1>
          <p className="mt-2 text-muted-foreground">
            管理你的所有小说作品，点击进入详情继续创作
          </p>
        </div>
        <Button
          onClick={() => navigate('/outline')}
          className="gap-2"
        >
          <Plus className="size-4" />
          创建新小说
        </Button>
      </div>

      {/* 空状态 */}
      {articles.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">还没有小说作品</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            去一句话大纲页面，选一个打动你的故事点子，开始你的第一部小说吧
          </p>
          <Button className="mt-4 gap-2" onClick={() => navigate('/outline')}>
            <Lightbulb className="size-4" />
            去生成大纲
          </Button>
        </div>
      )}

      {/* 小说列表 */}
      {sortedArticles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedArticles.map((article) => {
            const progress = getProgress(article);
            return (
              <Card
                key={article.id}
                className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => handleOpenBook(article.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-lg">{article.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(article.id);
                      }}
                      aria-label="删除"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {article.outline?.concept || '暂无一句话大纲'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {lengthBadge(article.lengthType)}
                    </Badge>
                    {article.category && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Tag className="size-3" />
                        {article.category.name}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>创作进度</span>
                      <span>
                        {progress.generated}/{progress.total} 章 · {progress.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {format(article.createdAt, 'yyyy-MM-dd')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {format(article.updatedAt, 'MM-dd HH:mm')}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              确认删除小说
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除《{deleteTarget?.title}》吗？删除后所有故事骨架、章节内容都将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
