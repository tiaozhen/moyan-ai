import { Check, Edit3, FileText, Plus, Loader2, Sparkles, Lock } from 'lucide-react';
import type { IChapter } from '@/data/novel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useGeneration } from '@/contexts/GenerationContext';

interface ChapterListProps {
  chapters: IChapter[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onGenerateChapter: (id: string) => void;
  onAddChapter?: () => void;
}

export default function ChapterList({
  chapters,
  currentId,
  onSelect,
  onGenerateChapter,
  onAddChapter,
}: ChapterListProps) {
  const { isChapterGenerating, isTaskRunning } = useGeneration();
  const anyGenerating = isTaskRunning('novel_chapter_generate');

  const statusIcon = (status: IChapter['status'], isGenerating: boolean) => {
    if (isGenerating) return <Loader2 className="size-4 animate-spin text-primary" />;
    switch (status) {
      case 'generated':
        return <FileText className="size-4 text-primary" />;
      case 'edited':
        return <Edit3 className="size-4 text-success" />;
      default:
        return <Lock className="size-4 text-muted-foreground/50" />;
    }
  };

  const statusLabel = (status: IChapter['status'], isGenerating: boolean) => {
    if (isGenerating) return '生成中';
    switch (status) {
      case 'generated':
        return '已生成';
      case 'edited':
        return '已编辑';
      default:
        return '未生成';
    }
  };

  const generatedCount = chapters.filter((c) => c.status !== 'unwritten').length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">章节列表</h3>
        {onAddChapter && (
          <button
            onClick={onAddChapter}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="新增章节"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {chapters.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            暂无章节
          </div>
        ) : (
          chapters.map((ch) => {
            const isActive = ch.id === currentId;
            const generating = isChapterGenerating(ch.id);
            return (
              <div key={ch.id}>
                <button
                  onClick={() => onSelect(ch.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-medium',
                      isActive
                        ? 'bg-primary/20 text-primary'
                        : generating
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {ch.chapterNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{ch.chapterTitle}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {statusIcon(ch.status, generating)}
                      <span>{statusLabel(ch.status, generating)}</span>
                    </div>
                  </div>
                  {ch.status === 'edited' && <Check className="size-3.5 text-success shrink-0" />}
                </button>

                {/* 生成按钮：未生成章节显示，有内容的也可重新生成 */}
                {ch.status === 'unwritten' && !generating && !anyGenerating && (
                  <div className="px-4 pb-2 -mt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerateChapter(ch.id);
                      }}
                    >
                      <Sparkles className="size-3" />
                      一键生成本章
                    </Button>
                  </div>
                )}
                {generating && (
                  <div className="px-4 pb-2 -mt-1">
                    <div className="flex items-center gap-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
                      <Loader2 className="size-3 animate-spin" />
                      <span className="truncate">正在生成本章...</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="text-xs text-muted-foreground">
          共 {chapters.length} 章 · 已完成 {generatedCount} 章
        </div>
      </div>
    </div>
  );
}
