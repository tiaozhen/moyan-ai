import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Save, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import type { IChapter, IStorySkeleton } from '@/data/novel';
import { loadCreationState, saveCreationState } from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';
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
  const [saving, setSaving] = useState(false);
  const [ghostText, setGhostText] = useState('');
  const { isTaskRunning, startChapterGeneration, getGeneratingChapterId, getChapterStreamingText } = useGeneration();
  const isGenerating =
    isTaskRunning('novel_continue') ||
    isTaskRunning('novel_polish') ||
    isTaskRunning('novel_expand');
  const isChapterGenerating = isTaskRunning('novel_chapter_generate');

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

  // 整章生成过程中，轮询 storage 同步最新内容到编辑器（后台生成也能看到进度）
  useEffect(() => {
    if (!isChapterGenerating) return;
    const timer = window.setInterval(() => {
      const state = loadCreationState();
      const genId = getGeneratingChapterId();
      if (genId) {
        const genChapter = state.chapters.find((c) => c.id === genId);
        if (genChapter) {
          // 更新内存中的章节列表
          setChapters((prev) =>
            prev.map((c) => (c.id === genId ? { ...genChapter } : c))
          );
          // 如果正在编辑的就是生成中的章节，同步编辑器内容
          if (genId === currentChapterId && editorRef.current) {
            if (editorRef.current.innerHTML !== genChapter.content) {
              // 保留光标位置不便，直接同步内容
              editorRef.current.innerHTML = genChapter.content || '';
              // 滚动到底部，跟随生成进度
              editorRef.current.scrollTop = editorRef.current.scrollHeight;
            }
          }
        }
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [isChapterGenerating, getGeneratingChapterId, currentChapterId]);

  // 整章生成完成后，重新读一次最新数据
  useEffect(() => {
    if (isChapterGenerating) return;
    // 从 running 变为 not running 时刷新一次
    const state = loadCreationState();
    if (state.chapters.length > 0) {
      setChapters(state.chapters);
      if (currentChapterId && editorRef.current) {
        const ch = state.chapters.find((c) => c.id === currentChapterId);
        if (ch && editorRef.current.innerHTML !== ch.content) {
          editorRef.current.innerHTML = ch.content || '';
        }
      }
    }
  }, [isChapterGenerating, currentChapterId]);

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

  // 生成指定章节的完整正文
  const handleGenerateChapter = useCallback(
    async (chapterId: string) => {
      if (!skeleton) {
        toast.warning('请先生成故事骨架');
        return;
      }
      // 如果当前不在该章节，先切换过去
      if (chapterId !== currentChapterId) {
        handleSelectChapter(chapterId);
      }
      // 让 AIAssistantPanel 去触发（保持入口统一），这里只做章节列表按钮触发
      // 实际触发由面板内部完成，但为了章节列表按钮也能触发，这里复制一份逻辑
      const state = loadCreationState();
      const chapter = state.chapters.find((c) => c.id === chapterId);
      if (!chapter) return;

      // 构建上下文（与 AIAssistantPanel 中的 buildChapterGenerationContext 保持一致）
      const idx = state.chapters.findIndex((c) => c.id === chapterId);
      const prevChapters = state.chapters.slice(0, idx);

      const skeletonParts: string[] = [];
      const chars = skeleton.characterSettings
        .slice(0, 5)
        .map((c) => `${c.name}（${c.identity}）：${c.personality || c.coreDemand || ''}`)
        .join('；');
      if (chars) skeletonParts.push(`主要人物：${chars}`);
      if (skeleton.worldView?.background) {
        skeletonParts.push(`世界观背景：${skeleton.worldView.background}`);
      }

      const prevTexts: string[] = [];
      let totalLen = 0;
      for (let i = prevChapters.length - 1; i >= 0; i--) {
        const ch = prevChapters[i];
        const plain = ch.content.replace(/<[^>]+>/g, '').trim();
        if (!plain) {
          prevTexts.unshift(`【第${ch.chapterNumber}章 ${ch.chapterTitle}】${ch.chapterSummary || ''}`);
          continue;
        }
        const distance = prevChapters.length - i;
        if (distance <= 3) {
          const snippet = plain.slice(0, 800);
          prevTexts.unshift(`【第${ch.chapterNumber}章 ${ch.chapterTitle}】${snippet}${plain.length > 800 ? '...' : ''}`);
          totalLen += snippet.length;
          if (totalLen > 2000) break;
        } else {
          prevTexts.unshift(`【第${ch.chapterNumber}章 ${ch.chapterTitle}】${ch.chapterSummary || ''}`);
        }
      }
      const prevContext = prevTexts.join('\n\n');

      const generationRequirement = [
        `请生成《第${chapter.chapterNumber}章 ${chapter.chapterTitle}》的完整正文内容。`,
        chapter.chapterSummary ? `本章概要：${chapter.chapterSummary}` : '',
        chapter.coreEvent ? `本章核心事件：${chapter.coreEvent}` : '',
        '字数控制在2000-3000字之间，分多个自然段落，对话和描写比例合理。',
        '严格承接前面章节的剧情、人物关系和世界观设定，保持人物性格一致、情节连贯。',
        '只输出正文内容，不要章节标题，不要任何解释或说明。',
      ]
        .filter(Boolean)
        .join('\n');

      await startChapterGeneration({
        chapterId,
        pluginId: 'novel_content_generate_1',
        input: {
          novel_outline: skeletonParts.join('\n'),
          current_context: prevContext,
          generation_requirement: generationRequirement,
        },
      });
    },
    [skeleton, currentChapterId, handleSelectChapter, startChapterGeneration]
  );

  // 生成下一章
  const handleGenerateNextChapter = useCallback(async () => {
    if (!currentChapterId) return;
    const state = loadCreationState();
    const idx = state.chapters.findIndex((c) => c.id === currentChapterId);
    if (idx < 0 || idx >= state.chapters.length - 1) return;
    const nextChapterId = state.chapters[idx + 1].id;
    handleGenerateChapter(nextChapterId);
  }, [currentChapterId, handleGenerateChapter]);

  const hasNextChapter = useMemo(() => {
    if (!currentChapterId) return false;
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    return idx >= 0 && idx < chapters.length - 1;
  }, [currentChapterId, chapters]);

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
            onGenerateChapter={handleGenerateChapter}
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
            setIsGenerating={() => {}}
            onGenerateNextChapter={handleGenerateNextChapter}
            hasNextChapter={hasNextChapter}
          />
        </aside>
      </div>

      {/* 悬浮工具栏 */}
      <EditorToolbar
        visible={toolbarVisible && !isGenerating && !isChapterGenerating}
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
            disabled={!currentChapter || isGenerating || isChapterGenerating}
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
