import { Check, Edit3, FileText, Plus, Lock } from 'lucide-react';
import type { IChapter } from '@/data/novel';
import { cn } from '@/lib/utils';

interface ChapterListProps {
  chapters: IChapter[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onAddChapter?: () => void;
}

export default function ChapterList({ chapters, currentId, onSelect, onAddChapter }: ChapterListProps) {
  const statusIcon = (status: IChapter['status']) => {
    switch (status) {
      case 'generated':
        return <FileText className="size-4 text-primary" />;
      case 'edited':
        return <Edit3 className="size-4 text-success" />;
      default:
        return <Lock className="size-4 text-muted-foreground/50" />;
    }
  };

  const statusLabel = (status: IChapter['status']) => {
    switch (status) {
      case 'generated':
        return '已生成';
      case 'edited':
        return '已编辑';
      default:
        return '未生成';
    }
  };

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
            return (
              <button
                key={ch.id}
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
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {ch.chapterNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{ch.chapterTitle}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {statusIcon(ch.status)}
                    <span>{statusLabel(ch.status)}</span>
                  </div>
                </div>
                {ch.status === 'edited' && <Check className="size-3.5 text-success shrink-0" />}
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="text-xs text-muted-foreground">
          共 {chapters.length} 章
        </div>
      </div>
    </div>
  );
}
