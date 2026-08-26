import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Save, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import type { IChapter, IStorySkeleton } from '@/data/novel';
import { loadCreationState, saveCreationState } from '@/lib/storage';
import ChapterList from './ChapterList';
import EditorToolbar from './EditorToolbar';
import AIAssistantPanel from './AIAssistantPanel';

export default function NovelGeneratorPage() {
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<IChapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<IStorySkeleton | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ghostText, setGhostText] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  // 加载状态
  useEffect(() => {
    const state = loadCreationState();
    if (state.chapters && state.chapters.length > 0) {
      setChapters(state.chapters);
      setCurrentChapterId(state.currentChapterId || state.chapters[0].id);
    }
    if (state.storySkeleton) {
      setSkeleton(state.storySkeleton);
    }
  }, []);

  const currentChapter = chapters.find((c) => c.id === currentChapterId) || null;

  // 初始化编辑器内容
  useEffect(() => {
    if (editorRef.current && currentChapter) {
      if (editorRef.current.innerHTML !== currentChapter.content) {
        editorRef.current.innerHTML = currentChapter.content || '';
      }
    }
  }, [currentChapterId, currentChapter?.id]);

  // 自动保存：更新内存 state + 写入本地存储
  const autoSave = useCallback(() => {
    if (!currentChapterId || !editorRef.current) return;
    const content = editorRef.current.innerHTML;

    setChapters((prev) => {
      const updated = prev.map((c) =>
        c.id === currentChapterId
          ? { ...c, content, status: (c.status === 'unwritten' ? 'generated' : 'edited') as IChapter['status'], lastModified: Date.now() }
          : c
      );
      // 同步写入本地存储
      const state = loadCreationState();
      saveCreationState({
        ...state,
        chapters: updated,
        currentChapterId,
      });
      return updated;
    });
  }, [currentChapterId]);

  const handleInput = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      autoSave();
    }, 1000);
  }, [autoSave]);

  // 手动保存
  const handleSave = useCallback(() => {
    setSaving(true);
    autoSave();
    // autoSave 内部已写 storage，这里只做 UI 反馈
    setTimeout(() => {
      toast.success('已保存');
      setSaving(false);
    }, 300);
  }, [autoSave]);

  // 选区变化 - 显示悬浮工具栏
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setToolbarVisible(false);
      setSelectedText('');
      return;
    }

    const text = selection.toString();
    if (!text || text.trim().length === 0) {
      setToolbarVisible(false);
      setSelectedText('');
      return;
    }

    // 检查选区是否在编辑器内
    const range = selection.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      const rect = range.getBoundingClientRect();
      setToolbarPos({
        top: rect.top + window.scrollY - 48,
        left: rect.left + rect.width / 2 + window.scrollX - 200,
      });
      setToolbarVisible(true);
      setSelectedText(text);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // 执行格式化命令
  const handleCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    autoSave();
  }, [autoSave]);

  // 选章节
  const handleSelectChapter = useCallback((id: string) => {
    // 先保存当前章节内容到 storage
    if (currentChapterId && editorRef.current) {
      const content = editorRef.current.innerHTML;
      const state = loadCreationState();
      const updatedChapters: IChapter[] = state.chapters.map((c) =>
        c.id === currentChapterId ? { ...c, content, lastModified: Date.now() } : c
      );
      saveCreationState({
        ...state,
        chapters: updatedChapters,
        currentChapterId: id,
      });
      setChapters(updatedChapters);
    }
    setCurrentChapterId(id);
    setGhostText('');
    setToolbarVisible(false);
  }, [currentChapterId]);

  // AI 插入文本（续写/末尾添加）
  const handleInsertText = useCallback(
    (text: string) => {
      if (!editorRef.current) return;

      // 在光标位置插入，或追加到末尾
      const selection = window.getSelection();
      const editor = editorRef.current;

      // 将纯文本转为段落 HTML
      const htmlText = text
        .split('\n')
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${p}</p>`)
        .join('');

      if (selection && !selection.isCollapsed && editor.contains(selection.anchorNode)) {
        // 有选区，在选区后插入
        const range = selection.getRangeAt(0);
        range.collapse(false);
        const temp = document.createElement('div');
        temp.innerHTML = htmlText;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = temp.firstChild)) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
        // 移动光标到末尾
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // 追加到末尾
        editor.innerHTML += htmlText;
        // 滚动到底部
        editor.scrollTop = editor.scrollHeight;
      }

      autoSave();
    },
    [autoSave]
  );

  // AI 替换选中文本（润色）
  const handleReplaceSelection = useCallback(
    (text: string) => {
      if (!editorRef.current) return;

      const htmlText = text
        .split('\n')
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${p}</p>`)
        .join('');

      const selection = window.getSelection();
      if (selection && selection.toString()) {
        document.execCommand('insertHTML', false, htmlText);
      }

      autoSave();
      setSelectedText('');
      setToolbarVisible(false);
    },
    [autoSave]
  );

  // 键盘事件 - Tab 接受幽灵文字
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Tab 键接受 AI 建议（如果有幽灵文字）
      if (e.key === 'Tab' && ghostText) {
        e.preventDefault();
        handleInsertText(ghostText);
        setGhostText('');
      }
      // Cmd/Ctrl + S 保存
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    },
    [ghostText, handleInsertText, handleSave]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:h-[calc(100vh-4rem)]">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 md:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/expansion')}
            className="gap-1"
          >
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BookOpen className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {currentChapter ? currentChapter.chapterTitle : '小说创作'}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentChapter
                  ? `第${currentChapter.chapterNumber}章 · ${chapters.length}章`
                  : '请选择章节'}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden md:inline-flex gap-1">
            <Sparkles className="size-3" />
            AI 创作模式
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            保存
          </Button>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧章节列表 */}
        <aside className="hidden w-64 shrink-0 border-r border-border md:block">
          <ChapterList
            chapters={chapters}
            currentId={currentChapterId}
            onSelect={handleSelectChapter}
          />
        </aside>

        {/* 中间编辑器 */}
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          {currentChapter ? (
            <div className="relative flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
                {/* 章节标题 */}
                <h1 className="mb-2 text-3xl font-bold text-foreground">
                  {currentChapter.chapterTitle}
                </h1>
                <p className="mb-8 text-sm text-muted-foreground">
                  {currentChapter.chapterSummary}
                </p>

                {/* 编辑器容器 */}
                <div className="relative">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    className="min-h-[60vh] w-full outline-none prose prose-sm max-w-none dark:prose-invert"
                    style={{
                      fontSize: '16px',
                      lineHeight: '1.8',
                      letterSpacing: '0.02em',
                    }}
                    data-placeholder="开始写作吧，或点击右侧 AI 助手让 AI 帮你续写..."
                  />

                  {/* 幽灵文字（AI 内联建议提示） */}
                  {ghostText && (
                    <div
                      className="pointer-events-none absolute text-muted-foreground/40"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {ghostText}
                      <span className="ml-1 text-xs text-primary/50">按 Tab 接受</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <Card className="w-full max-w-md border-dashed bg-card/30">
                <div className="p-12 text-center">
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                    <BookOpen className="size-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium">开始你的创作</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                    {chapters.length > 0
                      ? '从左侧章节列表中选择一个章节开始创作'
                      : '请先回到大纲拓展页面，生成故事骨架后再开始创作'}
                  </p>
                  {chapters.length === 0 && (
                    <Button
                      className="mt-4"
                      onClick={() => navigate('/expansion')}
                    >
                      去生成骨架
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}
        </main>

        {/* 右侧 AI 助手面板 */}
        <aside className="hidden w-72 shrink-0 border-l border-border lg:block">
          <AIAssistantPanel
            currentChapter={currentChapter}
            skeleton={skeleton}
            selectedText={selectedText}
            onInsertText={handleInsertText}
            onReplaceSelection={handleReplaceSelection}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
          />
        </aside>
      </div>

      {/* 悬浮工具栏 */}
      <EditorToolbar
        visible={toolbarVisible && !isGenerating}
        position={toolbarPos}
        onCommand={handleCommand}
      />

      {/* 移动端底部 AI 按钮（简易） */}
      <div className="border-t border-border bg-background p-3 md:hidden">
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1 gap-1"
            onClick={() => {
              if (currentChapter) {
                toast.info('AI 助手请在桌面端体验完整功能');
              }
            }}
            disabled={!currentChapter || isGenerating}
          >
            <Sparkles className="size-4" />
            AI 助手
          </Button>
          <Button variant="secondary" size="sm" className="gap-1" onClick={handleSave}>
            <Save className="size-4" />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
