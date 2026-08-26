import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  visible: boolean;
  position?: { top: number; left: number };
  onCommand: (command: string, value?: string) => void;
}

export default function EditorToolbar({ visible, position, onCommand }: EditorToolbarProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg',
        position ? '' : 'relative'
      )}
      style={
        position
          ? { top: `${position.top}px`, left: `${position.left}px` }
          : undefined
      }
      role="toolbar"
      aria-label="格式工具栏"
    >
      <ToolbarButton icon={<Heading1 className="size-3.5" />} onClick={() => onCommand('formatBlock', 'h1')} title="一级标题" />
      <ToolbarButton icon={<Heading2 className="size-3.5" />} onClick={() => onCommand('formatBlock', 'h2')} title="二级标题" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton icon={<Bold className="size-3.5" />} onClick={() => onCommand('bold')} title="加粗" />
      <ToolbarButton icon={<Italic className="size-3.5" />} onClick={() => onCommand('italic')} title="斜体" />
      <ToolbarButton icon={<Underline className="size-3.5" />} onClick={() => onCommand('underline')} title="下划线" />
      <ToolbarButton icon={<Strikethrough className="size-3.5" />} onClick={() => onCommand('strikeThrough')} title="删除线" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton icon={<List className="size-3.5" />} onClick={() => onCommand('insertUnorderedList')} title="无序列表" />
      <ToolbarButton icon={<ListOrdered className="size-3.5" />} onClick={() => onCommand('insertOrderedList')} title="有序列表" />
      <ToolbarButton icon={<Quote className="size-3.5" />} onClick={() => onCommand('formatBlock', 'blockquote')} title="引用" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton icon={<AlignLeft className="size-3.5" />} onClick={() => onCommand('justifyLeft')} title="左对齐" />
      <ToolbarButton icon={<AlignCenter className="size-3.5" />} onClick={() => onCommand('justifyCenter')} title="居中" />
      <ToolbarButton icon={<AlignRight className="size-3.5" />} onClick={() => onCommand('justifyRight')} title="右对齐" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton icon={<Undo className="size-3.5" />} onClick={() => onCommand('undo')} title="撤销" />
      <ToolbarButton icon={<Redo className="size-3.5" />} onClick={() => onCommand('redo')} title="重做" />
    </div>
  );
}

function ToolbarButton({
  icon,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={title}
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
    >
      {icon}
    </Button>
  );
}
