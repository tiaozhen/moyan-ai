import { useState } from 'react';
import { ChevronDown, BookOpen, FileText, CheckCircle2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { INovelArticle } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import { cn } from '@/lib/utils';

interface ArticleSwitcherProps {
  articles: INovelArticle[];
  currentArticleId: string | null;
  onSwitch: (articleId: string) => void;
  showProgress?: boolean;
  className?: string;
}

export default function ArticleSwitcher({
  articles,
  currentArticleId,
  onSwitch,
  showProgress = false,
  className,
}: ArticleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = articles.find((a) => a.id === currentArticleId) || null;

  const progressText = (article: INovelArticle) => {
    if (article.chapters.length === 0) return '0 章';
    const done = article.chapters.filter((c) => c.status !== 'unwritten').length;
    return `${done}/${article.chapters.length} 章`;
  };

  if (!current && articles.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        暂无文章
      </div>
    );
  }

  return (
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
          articles.map((article) => {
            const opt = NOVEL_LENGTH_OPTIONS[article.lengthType];
            const isActive = article.id === currentArticleId;
            return (
              <DropdownMenuItem
                key={article.id}
                onClick={() => {
                  onSwitch(article.id);
                  setOpen(false);
                }}
                className="flex-col items-start gap-1 py-2.5"
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
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
