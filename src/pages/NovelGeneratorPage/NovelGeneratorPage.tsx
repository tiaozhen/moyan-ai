import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Save, Loader2, Sparkles, FileText, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import type { IChapter, IStorySkeleton, INovelArticle } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import {
  loadCreationState,
  saveCreationState,
  getCurrentArticle,
  setCurrentArticle,
  updateCurrentArticle,
  setArticleCurrentChapterId,
  deleteArticle as deleteArticleFromState,
} from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';
import { buildChapterGenerationInput } from '@/lib/chapter-context';
import ArticleSwitcher from '@/components/ArticleSwitcher';
import ChapterList from './ChapterList';
import EditorToolbar from './EditorToolbar';
import AIAssistantPanel from './AIAssistantPanel';

export default function NovelGeneratorPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<INovelArticle[]>([]);
  const [currentArticleId, setCurrentArticleIdState] = useState<string | null>(null);
  const [chapters, setChapters] = useState<IChapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<IStorySkeleton | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | undefined>();
  const [saving, setSaving] = useState(false);
  const [ghostText, setGhostText] = useState('');
  const { isTaskRunning, startChapterGeneration, getGeneratingChapterId, getChapterStreamingText, getBookProgress } = useGeneration();
  const isGenerating =
    isTaskRunning('novel_continue') ||
    isTaskRunning('novel_polish') ||
    isTaskRunning('novel_expand');
  const isChapterGenerating = isTaskRunning('novel_chapter_generate');
  const isBookGenerating = isTaskRunning('novel_book_generate');
  const isAnyGenerating = isChapterGenerating || isBookGenerating;

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  const currentArticle = articles.find((a) => a.id === currentArticleId) || null;

  // 加载文章数据
  useEffect(() => {
    const state = loadCreationState();
    setArticles(state.articles);
    setCurrentArticleIdState(state.currentArticleId);
    const article = getCurrentArticle(state);
    if (article) {
      setChapters(article.chapters);
      setCurrentChapterId(article.currentChapterId || article.chapters[0]?.id || null);
      setSkeleton(article.storySkeleton);
    }
  }, []);

  // 切换文章
  const handleSwitchArticle = useCallback(
    (articleId: string) => {
      const state = loadCreationState();
      const next = setCurrentArticle(state, articleId);
      saveCreationState(next);
      const article = next.articles.find((a) => a.id === articleId) || null;
      setArticles(next.articles);
      setCurrentArticleIdState(next.currentArticleId);
      setChapters(article?.chapters || []);
      setCurrentChapterId(article?.currentChapterId || article?.chapters[0]?.id || null);
      setSkeleton(article?.storySkeleton || null);
      setGhostText('');
    },
    []
  );

  const handleDeleteArticle = useCallback(
    (articleId: string) => {
      const state = loadCreationState();
      const next = deleteArticleFromState(state, articleId);
      saveCreationState(next);
      setArticles(next.articles);
      setCurrentArticleIdState(next.currentArticleId);
      if (next.currentArticleId) {
        const article = next.articles.find((a) => a.id === next.currentArticleId) || null;
        setChapters(article?.chapters || []);
        setCurrentChapterId(article?.currentChapterId || article?.chapters[0]?.id || null);
        setSkeleton(article?.storySkeleton || null);
      } else {
        setChapters([]);
        setCurrentChapterId(null);
        setSkeleton(null);
      }
      setGhostText('');
    },
    []
  );

  // 整章生成 / 整本书生成过程中，轮询 storage 同步最新内容到编辑器
  useEffect(() => {
    if (!isAnyGenerating) return;
    const timer = window.setInterval(() => {
      const state = loadCreationState();
      const article = getCurrentArticle(state);
      const genId = getGeneratingChapterId();
      if (genId && article) {
        const genChapter = article.chapters.find((c) => c.id === genId);
        if (genChapter) {
          setChapters((prev) =>
            prev.map((c) => (c.id === genId ? { ...genChapter } : c))
          );
          // 整本书模式下，自动切换到当前生成中的章节
          if (isBookGenerating && genId !== currentChapterId) {
            setCurrentChapterId(genId);
            if (editorRef.current) {
              editorRef.current.innerHTML = genChapter.content || '';
              editorRef.current.scrollTop = editorRef.current.scrollHeight;
            }
            return;
          }
          if (genId === currentChapterId && editorRef.current) {
            if (editorRef.current.innerHTML !== genChapter.content) {
              editorRef.current.innerHTML = genChapter.content || '';
              editorRef.current.scrollTop = editorRef.current.scrollHeight;
            }
          }
        }
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [isAnyGenerating, getGeneratingChapterId, currentChapterId, isBookGenerating]);

  // 生成完成后，重新读一次最新数据
  useEffect(() => {
    if (isAnyGenerating) return;
    const state = loadCreationState();
    const article = getCurrentArticle(state);
    if (article && article.chapters.length > 0) {
      setChapters(article.chapters);
      if (currentChapterId && editorRef.current) {
        const ch = article.chapters.find((c) => c.id === currentChapterId);
        if (ch && editorRef.current.innerHTML !== ch.content) {
          editorRef.current.innerHTML = ch.content || '';
        }
      }
    }
  }, [isAnyGenerating, currentChapterId]);

  const currentChapter = chapters.find((c) => c.id === currentChapterId) || null;

  // 初始化编辑器内容
  useEffect(() => {
    if (editorRef.current && currentChapter) {
      if (editorRef.current.innerHTML !== currentChapter.content) {
        editorRef.current.innerHTML = currentChapter.content || '';
      }
    }
  }, [currentChapterId, currentChapter?.id]);

  // 自动保存：更新内存 state + 写入当前文章
  const autoSave = useCallback(() => {
    if (!currentChapterId || !currentArticleId || !editorRef.current) return;
    const content = editorRef.current.innerHTML;

    setChapters((prev) => {
      const updated = prev.map((c) =>
        c.id === currentChapterId
          ? { ...c, content, status: (c.status === 'unwritten' ? 'generated' : 'edited') as IChapter['status'], lastModified: Date.now() }
          : c
      );
      // 写入当前文章
      const state = loadCreationState();
      const newState = updateCurrentArticle(state, (a) => ({
        ...a,
        chapters: updated,
        currentChapterId,
      }));
      saveCreationState(newState);
      setArticles(newState.articles);
      return updated;
    });
  }, [currentChapterId, currentArticleId]);

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

  const handleSelectChapter = useCallback(
    (chapterId: string) => {
      // 切换前先保存当前章节
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      autoSave();
      setCurrentChapterId(chapterId);
      // 写入当前文章的当前章节
      const state = loadCreationState();
      const newState = setArticleCurrentChapterId(state, chapterId);
      saveCreationState(newState);
      setArticles(newState.articles);
      setGhostText('');
    },
    [autoSave]
  );

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
      const state = loadCreationState();
      const chapter = state.chapters.find((c) => c.id === chapterId);
      if (!chapter) return;

      // 如果当前不在该章节，先切换过去（保存当前内容）
      if (chapterId !== currentChapterId) {
        handleSelectChapter(chapterId);
      }

      const input = buildChapterGenerationInput(chapter, skeleton, state.chapters);

      await startChapterGeneration({
        chapterId,
        pluginId: 'novel_content_generate_1',
        input,
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

  // 章节连贯性校验：比较本章规划起点与上一章实际结尾的相似度
  const continuityWarning = useMemo(() => {
    if (!currentChapter || !skeleton?.chapterPlan?.length) return null;
    const idx = chapters.findIndex((c) => c.id === currentChapter.id);
    if (idx <= 0) return null; // 第一章无前文

    const prevChapter = chapters[idx - 1];
    const prevContent = (prevChapter.content || '').replace(/<[^>]+>/g, '').trim();
    if (!prevContent || prevContent.length < 50) return null; // 上章内容太少不校验

    const planStart = (currentChapter as any).chapterStart || '';
    if (!planStart) return null; // 无规划起点

    // 提取上一章最后约200字作为结尾
    const prevEnding = prevContent.slice(-200);

    // 简单关键词重叠校验：提取规划起点中的关键词（2字以上实词），看上章结尾是否出现
    const keywords = planStart
      .replace(/[，。、；：！？\s「」《》（）【】"'\.\,\!\?]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length >= 2 && w.length <= 6);

    if (keywords.length === 0) return null;

    let matchCount = 0;
    for (const kw of keywords) {
      if (prevEnding.includes(kw)) matchCount++;
    }

    const matchRate = matchCount / keywords.length;
    if (matchRate < 0.2 && keywords.length >= 3) {
      return {
        level: 'warn' as const,
        message: `本章规划的起点与上一章实际结尾内容衔接度较低，建议检查衔接是否自然，或在生成时添加衔接说明。`,
        planStart,
      };
    }
    return null;
  }, [currentChapter, chapters, skeleton]);
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
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 md:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/expansion')}
            className="gap-1 shrink-0"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden md:inline">返回骨架</span>
          </Button>
          {currentArticle ? (
            <>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <BookOpen className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {currentChapter ? currentChapter.chapterTitle : '小说创作'}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {currentArticle.title} · {chapters.length}章
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">未选择文章</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentArticle && (
            <ArticleSwitcher
              articles={articles}
              currentArticleId={currentArticleId}
              onSwitch={handleSwitchArticle}
              onDelete={handleDeleteArticle}
              showProgress
            />
          )}
          <Badge variant="outline" className="hidden md:inline-flex gap-1">
            <Sparkles className="size-3" />
            AI 创作模式
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={saving || !currentArticle}
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

      {/* 无文章空状态 */}
      {!currentArticle && (
        <div className="flex flex-1 items-center justify-center">
          <Card className="w-full max-w-md border-dashed bg-card/30 mx-4">
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                <FileText className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium">暂无文章</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                请先前往一句话大纲页面，选择一个故事点子并创建文章
              </p>
              <Button className="mt-4" onClick={() => navigate('/outline')}>
                去创建文章
              </Button>
            </div>
          </Card>
        </div>
       )}

      {/* 三栏布局 */}
      {currentArticle && (
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
                <p className="mb-4 text-sm text-muted-foreground">
                  {currentChapter.chapterSummary}
                </p>

                {/* 连贯性校验提示 */}
                {continuityWarning && (
                  <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">衔接提醒</div>
                      <div className="mt-0.5 text-xs opacity-90">{continuityWarning.message}</div>
                    </div>
                  </div>
                )}

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
      )}

      {/* 悬浮工具栏 */}
      <EditorToolbar
        visible={toolbarVisible && !isGenerating && !isAnyGenerating}
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
