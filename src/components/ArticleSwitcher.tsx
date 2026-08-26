import { useState } from 'react';
import {
  ChevronDown,
  BookOpen,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { INovelArticle } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import { cn } from '@/lib/utils';

interface ArticleSwitcherProps {
  articles: INovelArticle[];
  currentArticleId: string | null;
  onSwitch: (articleId: string) => void;
  onDelete?: (articleId: string) => void;
  showProgress?: boolean;
  className?: string;
}

export default function ArticleSwitcher({
  articles,
  currentArticleId,
  onSwitch,
  onDelete,
  showProgress = false,
  className,
}: ArticleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<INovelArticle | null>(null);
  const current = articles.find((a) => a.id === currentArticleId) || null;

  const progressText = (article: INovelArticle) => {
    if (article.chapters.length === 0) return '0 章';
    const done = article.chapters.filter((c) => c.status !== 'unwritten').length;
    return `${done}/${article.chapters.length} 章`;
  };

  const handleDeleteClick = (article: INovelArticle) => {
    setArticleToDelete(article);
    setConfirmOpen(true);
    setOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!articleToDelete) return;
    onDelete?.(articleToDelete.id);
    toast.success('文章已删除');
    setConfirmOpen(false);
    setArticleToDelete(null);
  };

  if (!current && articles.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        暂无文章
      </div>
    );
  }

  const deleteArticle = articleToDelete;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-auto gap-2 px-2 py-1.5', className)}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BookOpen className="size-4" />
            </div>
            <div className="flex flex-col items-start gap-0.5 min-w-0 max-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {current ? current.title : '未选择文章'}
                </span>
                {current && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">
                    {NOVEL_LENGTH_OPTIONS[current.lengthType].label}
                  </Badge>
                )}
              </div>
              {current && showProgress && (
                <div className="text-[11px] text-muted-foreground">
                  进度 {progressText(current)}
                </div>
              )}
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>我的文章</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {articles.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              暂无文章，去一句话大纲页创建
            </div>
          ) : (
            <DropdownMenuGroup>
              {articles.map((article) => {
                const opt = NOVEL_LENGTH_OPTIONS[article.lengthType];
                const isActive = article.id === currentArticleId;
                return (
                  <div key={article.id} className="group relative">
                    <DropdownMenuItem
                      onClick={() => {
                        onSwitch(article.id);
                        setOpen(false);
                      }}
                      className="flex-col items-start gap-1 py-2.5 pr-10"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={cn('truncate font-medium', isActive && 'text-primary')}>
                          {article.title}
                        </span>
                        {isActive && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                      </div>
                      <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">
                          {opt.label}
                        </Badge>
                        <span>·</span>
                        <span>{progressText(article)}</span>
                      </div>
                    </DropdownMenuItem>
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(article);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label={`删除 ${article.title}`}
                        title="删除文章"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              确认删除文章
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  确定要删除 <span className="font-semibold text-foreground">「{deleteArticle?.title}」</span> 吗？
                </p>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">篇幅类型</span>
                    <span>{deleteArticle ? NOVEL_LENGTH_OPTIONS[deleteArticle.lengthType].label : '-'}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground">章节数量</span>
                    <span>{deleteArticle?.chapters.length ?? 0} 章</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>{deleteArticle ? format(deleteArticle.createdAt, 'yyyy-MM-dd HH:mm') : '-'}</span>
                  </div>
                </div>
                <p className="text-sm text-destructive">
                  删除后该文章的所有数据（故事骨架、章节规划、正文内容）将被永久清除，无法恢复。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
