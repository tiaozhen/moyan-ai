import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, Save, Loader2, Sparkles, FileText, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import type { IChapter, IStorySkeleton, INovelArticle } from '@/data/novel';
import {
  loadCreationState,
  saveCreationState,
  updateArticleById,
  setArticleChapterId,
} from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';
import { buildChapterGenerationInput } from '@/lib/chapter-context';
import ChapterList from '@/pages/NovelGeneratorPage/ChapterList';
import EditorToolbar from '@/pages/NovelGeneratorPage/EditorToolbar';
import AIAssistantPanel from '@/pages/NovelGeneratorPage/AIAssistantPanel';

export default function BookEditorTab() {
  const { bookId } = useParams<{ bookId: string }>();
  const [chapters, setChapters] = useState<IChapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<IStorySkeleton | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | undefined>();
  const [saving, setSaving] = useState(false);
  const [isAnyGeneratingState, setIsAnyGeneratingState] = useState(false);
  const {
    isTaskRunning,
    startChapterGeneration,
    getGeneratingChapterId,
    getChapterStreamingText,
    getBookProgress,
    pauseTask,
    resumeTask,
    stopTask,
    getTaskPauseStatus,
  } = useGeneration();

  const isGenerating =
    isTaskRunning('novel_continue') ||
    isTaskRunning('novel_polish') ||
    isTaskRunning('novel_expand');
  const isChapterGenerating = isTaskRunning('novel_chapter_generate');
  const isBookGenerating = isTaskRunning('novel_book_generate');
  const isAnyGenerating = isChapterGenerating || isBookGenerating;

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  // 加载当前书籍数据
  useEffect(() => {
    if (!bookId) return;
    const state = loadCreationState();
    const article = state.articles.find((a) => a.id === bookId) || null;
    if (!article) {
      setChapters([]);
      setCurrentChapterId(null);
      setSkeleton(null);
      return;
    }
    // 如果有章节规划但没章节，基于章节规划初始化
    let initChapters: IChapter[] = article.chapters;
    if (initChapters.length === 0 && article.storySkeleton) {
      initChapters = article.storySkeleton.chapterPlan.map((meta) => ({
        ...meta,
        id: meta.id,
        content: '',
        status: 'unwritten' as const,
        lastModified: Date.now(),
      }));
      const newState = updateArticleById(state, bookId, (a) => ({
        ...a,
        chapters: initChapters,
        currentChapterId: initChapters[0]?.id || null,
      }));
      saveCreationState(newState);
    }
    setChapters(initChapters);
    setCurrentChapterId(article.currentChapterId || initChapters[0]?.id || null);
    setSkeleton(article.storySkeleton);
  }, [bookId]);

  // 轮询：整本书生成过程中同步章节数据 + 当前章节切换
  useEffect(() => {
    if (!bookId) return;
    if (!isBookGenerating && !isChapterGenerating) return;
    const interval = setInterval(() => {
      const state = loadCreationState();
      const article = state.articles.find((a) => a.id === bookId) || null;
      if (!article) return;
      setChapters(article.chapters);
      const genId = getGeneratingChapterId();
      if (genId && currentChapterId !== genId) {
        setCurrentChapterId(genId);
        if (editorRef.current) {
          const ch = article.chapters.find((c) => c.id === genId);
          if (ch) {
            editorRef.current.innerHTML = ch.content || '';
          }
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isBookGenerating, isChapterGenerating, bookId, currentChapterId, getGeneratingChapterId]);

  const currentChapter = chapters.find((c) => c.id === currentChapterId) || null;

  // 自动保存
  const autoSave = useCallback(() => {
    if (!bookId || !currentChapterId || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const state = loadCreationState();
    const next = updateArticleById(state, bookId, (a) => {
      const updatedChapters = a.chapters.map((c) =>
        c.id === currentChapterId
          ? {
              ...c,
              content,
              status: c.status === 'unwritten' ? 'edited' : c.status,
              lastModified: Date.now(),
            }
          : c
      );
      return { ...a, chapters: updatedChapters };
    });
    saveCreationState(next);
    setChapters(
      chapters.map((c) =>
        c.id === currentChapterId
          ? { ...c, content, status: c.status === 'unwritten' ? 'edited' : c.status, lastModified: Date.now() }
          : c
      )
    );
  }, [bookId, currentChapterId, chapters]);

  // 编辑器输入
  const handleEditorInput = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setSaving(true);
    saveTimerRef.current = window.setTimeout(() => {
      autoSave();
      setSaving(false);
      toast.success('已保存', { id: 'save-chapter' });
    }, 800);
  }, [autoSave]);

  // 选区工具栏
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
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // 执行格式化命令
  const handleCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    autoSave();
  }, [autoSave]);

  // 选择章节
  const handleSelectChapter = useCallback(
    (chapterId: string) => {
      if (!bookId) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      autoSave();
      setCurrentChapterId(chapterId);
      const state = loadCreationState();
      const next = setArticleChapterId(state, bookId, chapterId);
      saveCreationState(next);
    },
    [bookId, autoSave]
  );

  // AI 插入文本
  const handleInsertText = useCallback(
    (text: string) => {
      if (!editorRef.current) return;
      const selection = window.getSelection();
      const editor = editorRef.current;

      const htmlText = text
        .split('\n')
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${p}</p>`)
        .join('');

      if (selection && !selection.isCollapsed && editor.contains(selection.anchorNode)) {
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
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.innerHTML += htmlText;
        editor.scrollTop = editor.scrollHeight;
      }

      autoSave();
    },
    [autoSave]
  );

  // 替换选区文本
  const handleReplaceSelection = useCallback(
    (text: string) => {
      if (!editorRef.current) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        handleInsertText(text);
        return;
      }
      const htmlText = text
        .split('\n')
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${p}</p>`)
        .join('');
      document.execCommand('insertHTML', false, htmlText);
      autoSave();
    },
    [autoSave, handleInsertText]
  );

  // 生成章节正文
  const handleGenerateChapter = useCallback(
    async (chapterId: string) => {
      if (!bookId || !skeleton) {
        toast.warning('请先生成故事骨架');
        return;
      }
      const chapter = chapters.find((c) => c.id === chapterId);
      if (!chapter) return;

      if (chapterId !== currentChapterId) {
        handleSelectChapter(chapterId);
      }

      const input = buildChapterGenerationInput(chapter, skeleton, chapters);

      await startChapterGeneration({
        chapterId,
        pluginId: 'novel_content_generate_1',
        input,
        articleId: bookId,
      });
    },
    [bookId, chapters, currentChapterId, skeleton, handleSelectChapter, startChapterGeneration]
  );

  // 生成下一章
  const handleGenerateNextChapter = useCallback(async () => {
    if (!currentChapterId) return;
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    if (idx < 0 || idx >= chapters.length - 1) return;
    const nextChapterId = chapters[idx + 1].id;
    handleGenerateChapter(nextChapterId);
  }, [currentChapterId, chapters, handleGenerateChapter]);

  const hasNextChapter = useMemo(() => {
    if (!currentChapterId) return false;
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    return idx >= 0 && idx < chapters.length - 1;
  }, [currentChapterId, chapters]);

  const progress = useMemo(() => {
    if (chapters.length === 0) return { generated: 0, total: 0, percent: 0 };
    const generated = chapters.filter((c) => c.status !== 'unwritten').length;
    return { generated, total: chapters.length, percent: Math.round((generated / chapters.length) * 100) };
  }, [chapters]);

  const bookProgress = getBookProgress();
  const bookPauseStatus = getTaskPauseStatus('novel_book_generate');
  const isBookPaused = bookPauseStatus === 'paused';
  const isBookStopped = bookPauseStatus === 'stopped';

  const handlePause = useCallback(() => {
    pauseTask('novel_book_generate');
  }, [pauseTask]);

  const handleResume = useCallback(() => {
    resumeTask('novel_book_generate');
  }, [resumeTask]);

  const handleStop = useCallback(() => {
    stopTask('novel_book_generate');
  }, [stopTask]);

  if (!bookId) {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-0 w-full">
      {/* 左栏：章节列表 */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border bg-card/30">
        <div className="border-b border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">章节列表</span>
            <Badge variant="outline" className="text-[11px] font-normal">
              {progress.generated}/{progress.total}
            </Badge>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {isBookGenerating && bookProgress && (
            <div className="mt-2 flex items-center gap-2 text-xs text-primary">
              <Loader2 className="size-3 animate-spin" />
              整本书生成中 {bookProgress.currentIndex + 1}/{bookProgress.total}
            </div>
          )}
          {(isBookPaused || isBookStopped) && (
            <div className="mt-2 flex gap-1 text-xs">
              <Button size="sm" variant="outline" className="h-6 flex-1 text-xs" onClick={handleResume}>
                继续
              </Button>
              <Button size="sm" variant="outline" className="h-6 flex-1 text-xs text-destructive" onClick={handleStop}>
                停止
              </Button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChapterList
            chapters={chapters}
            currentId={currentChapterId}
            onSelect={handleSelectChapter}
            onGenerateChapter={handleGenerateChapter}
          />
        </div>
      </div>

      {/* 中栏：编辑器 */}
      <div className="relative flex flex-1 flex-col min-w-0">
        {/* 编辑区顶部 */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">
              {currentChapter ? `第${currentChapter.chapterNumber}章 ${currentChapter.chapterTitle}` : '选择章节开始创作'}
            </div>
            {currentChapter && (
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] font-normal">
                  {currentChapter.phase}
                </Badge>
                <span className="truncate">{currentChapter.coreEvent}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                保存中...
              </span>
            )}
          </div>
        </div>

        {/* 选区浮动工具栏 */}
        <EditorToolbar
          visible={toolbarVisible}
          position={toolbarPos}
          onCommand={handleCommand}
        />

        {/* 编辑器 */}
        {currentChapter ? (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            className="flex-1 overflow-y-auto px-12 py-8 text-base leading-relaxed text-foreground outline-none focus:outline-none"
            dangerouslySetInnerHTML={{ __html: currentChapter.content || '' }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 size-10 opacity-40" />
              <p>从左侧选择一个章节开始创作</p>
            </div>
          </div>
        )}

        {/* 章节生成中的提示 */}
        {isChapterGenerating && currentChapter && getGeneratingChapterId() === currentChapter.id && (
          <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/90 px-6 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <Loader2 className="size-4 animate-spin text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">正在生成章节内容...</div>
                <div className="text-xs text-muted-foreground">
                  已生成约 {getChapterStreamingText()?.length || 0} 字
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右栏：AI助手面板 */}
      <AIAssistantPanel
        currentChapter={currentChapter}
        skeleton={skeleton}
        selectedText={selectedText}
        onInsertText={handleInsertText}
        onReplaceSelection={handleReplaceSelection}
        onGenerateNextChapter={handleGenerateNextChapter}
        hasNextChapter={hasNextChapter}
        isGenerating={isGenerating}
        setIsGenerating={setIsAnyGeneratingState}
        articleId={bookId}
      />
    </div>
  );
}
