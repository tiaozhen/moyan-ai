import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Wand2,
  Maximize2,
  Loader2,
  CheckCircle2,
  FileText,
  ChevronRight,
  AlertCircle,
  Pause,
  Play,
  Square,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
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
import type { IChapter, IStorySkeleton } from '@/data/novel';
import { useGeneration } from '@/contexts/GenerationContext';
import { loadCreationState } from '@/lib/storage';
import { buildChapterGenerationInput } from '@/lib/chapter-context';

interface AIAssistantPanelProps {
  currentChapter: IChapter | null;
  skeleton: IStorySkeleton | null;
  selectedText: string;
  onInsertText: (text: string) => void;
  onReplaceSelection: (text: string) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  onGenerateNextChapter?: () => void;
  hasNextChapter: boolean;
  articleId?: string;
}

type AIAction = 'continue' | 'polish' | 'expand' | null;

export default function AIAssistantPanel({
  currentChapter,
  skeleton,
  selectedText,
  onInsertText,
  onReplaceSelection,
  isGenerating,
  setIsGenerating,
  onGenerateNextChapter,
  hasNextChapter,
  articleId,
}: AIAssistantPanelProps) {
  const [activeAction, setActiveAction] = useState<AIAction>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [bookGenMode, setBookGenMode] = useState<'incremental' | 'overwrite'>('incremental');
  const [totalChapters, setTotalChapters] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const {
    startNovelGeneration,
    getNovelStreamingText,
    isTaskRunning,
    startChapterGeneration,
    getChapterStreamingText,
    isChapterGenerating,
    getGeneratingChapterId,
    startBookGeneration,
    getBookProgress,
    pauseTask,
    resumeTask,
    stopTask,
    getTaskPauseStatus,
  } = useGeneration();
  const pollRef = useRef<number | null>(null);

  const chapterGenerating =
    isTaskRunning('novel_chapter_generate') &&
    currentChapter &&
    isChapterGenerating(currentChapter.id);

  const bookGenerating = isTaskRunning('novel_book_generate');
  const bookPauseStatus = getTaskPauseStatus('novel_book_generate');
  const bookProgress = getBookProgress();
  const isBookPaused = bookPauseStatus === 'paused';

  const anyNovelTaskRunning =
    isTaskRunning('novel_continue') ||
    isTaskRunning('novel_polish') ||
    isTaskRunning('novel_expand');

  // 整体生成中状态（包括整章生成、整本书生成）
  const overallGenerating =
    isGenerating || isTaskRunning('novel_chapter_generate') || bookGenerating;

  // 轮询同步流式文本（后台生成时也能看到）
  useEffect(() => {
    if (!anyNovelTaskRunning && !chapterGenerating) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = window.setInterval(() => {
      if (chapterGenerating) {
        setStreamingText(getChapterStreamingText());
      } else if (anyNovelTaskRunning) {
        setStreamingText(getNovelStreamingText());
      }
    }, 150);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [
    anyNovelTaskRunning,
    chapterGenerating,
    getNovelStreamingText,
    getChapterStreamingText,
  ]);

  // 同步全局生成状态到本地 isGenerating
  useEffect(() => {
    setIsGenerating(anyNovelTaskRunning || isTaskRunning('novel_chapter_generate'));
    if (!anyNovelTaskRunning && !isTaskRunning('novel_chapter_generate')) {
      // 生成结束后延迟清空流式文本，让用户看到完成态
      const timer = window.setTimeout(() => setStreamingText(''), 2000);
      return () => window.clearTimeout(timer);
    }
    return;
  }, [anyNovelTaskRunning, isTaskRunning, setIsGenerating]);

  // 切页回来时恢复 activeAction
  useEffect(() => {
    if (isTaskRunning('novel_continue')) setActiveAction('continue');
    else if (isTaskRunning('novel_polish')) setActiveAction('polish');
    else if (isTaskRunning('novel_expand')) setActiveAction('expand');
  }, [isTaskRunning]);

  // ========== 整章生成 ==========
  const handleGenerateChapter = useCallback(async () => {
    if (!currentChapter || !skeleton || chapterGenerating) return;

    // 如果已有内容，弹窗确认
    if (currentChapter.content && currentChapter.content.trim().length > 0) {
      setShowRegenerateConfirm(true);
      return;
    }
    startGeneration();
  }, [currentChapter, skeleton, chapterGenerating]);

  const startGeneration = useCallback(async () => {
    if (!currentChapter || !skeleton) return;

    const state = loadCreationState();
    const input = buildChapterGenerationInput(
      currentChapter,
      skeleton,
      state.chapters,
      customPrompt
    );

    await startChapterGeneration({
      chapterId: currentChapter.id,
      pluginId: 'novel_content_generate_1',
      input,
      articleId,
    });
    setCustomPrompt('');
  }, [currentChapter, skeleton, customPrompt, startChapterGeneration]);

  const buildOutlineContext = useCallback(() => {
    if (!skeleton) return '';
    const mainChars = skeleton.characterSettings
      .slice(0, 3)
      .map((c) => `${c.name}（${c.identity}）`)
      .join('、');
    const ch = currentChapter as any;
    const chapterDetailParts: string[] = [];
    if (ch?.coreEvent) chapterDetailParts.push(`核心事件：${ch.coreEvent}`);
    if (ch?.characters) chapterDetailParts.push(`出场人物：${ch.characters}`);
    if (ch?.sceneLocation) chapterDetailParts.push(`场景地点：${ch.sceneLocation}`);
    if (ch?.moodTone) chapterDetailParts.push(`情绪基调：${ch.moodTone}`);
    if (ch?.chapterEnd) chapterDetailParts.push(`本章应写到：${ch.chapterEnd}`);
    if (ch?.foreshadowing) chapterDetailParts.push(`伏笔处理：${ch.foreshadowing}`);
    return [
      `故事背景：${skeleton.worldView.background}`,
      `主要人物：${mainChars}`,
      `当前章节：第${ch?.chapterNumber || ''}章 ${ch?.chapterTitle || ''}`,
      `章节概要：${ch?.chapterSummary || ''}`,
      ...chapterDetailParts,
    ].filter(Boolean).join('\n');
   }, [skeleton, currentChapter]);

  // ========== 整本书生成 ==========
  const handleGenerateBook = useCallback(() => {
    if (!currentChapter || !skeleton || bookGenerating) return;
    const state = loadCreationState();
    const chapters = articleId
      ? (state.articles.find((a) => a.id === articleId)?.chapters || [])
      : state.chapters || [];
    setTotalChapters(chapters.length);
    const idx = chapters.findIndex((c) => c.id === currentChapter.id);
    setCurrentIndex(idx);
    setShowBookDialog(true);
  }, [currentChapter, skeleton, bookGenerating, articleId]);

  const startBookGenerationFrom = useCallback(
    async (mode: 'fromCurrent' | 'fromStart') => {
      if (!skeleton) return;
      // 覆盖模式需要二次确认
      if (bookGenMode === 'overwrite') {
        const confirmMsg = mode === 'fromStart'
          ? '此操作将覆盖全书所有章节的现有正文内容，是否继续？'
          : '此操作将覆盖从本章到结尾所有章节的现有正文内容，是否继续？';
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }
      setShowBookDialog(false);
      const state = loadCreationState();
      const chapters = state.chapters || [];
      let startChapterId: string;
      if (mode === 'fromStart') {
        startChapterId = chapters[0]?.id || currentChapter?.id || '';
      } else {
        startChapterId = currentChapter?.id || chapters[0]?.id || '';
      }
      if (!startChapterId) return;

      const buildInput = (chapterId: string) => {
        const ch = chapters.find((c) => c.id === chapterId);
        if (!ch) return {};
        const mainChars = skeleton.characterSettings
          .slice(0, 3)
          .map((c) => `${c.name}（${c.identity}）`)
          .join('、');
        const chapterDetailParts: string[] = [];
        const cc = ch as any;
        if (cc?.coreEvent) chapterDetailParts.push(`核心事件：${cc.coreEvent}`);
        if (cc?.characters) chapterDetailParts.push(`出场人物：${cc.characters}`);
        if (cc?.sceneLocation) chapterDetailParts.push(`场景地点：${cc.sceneLocation}`);
        if (cc?.moodTone) chapterDetailParts.push(`情绪基调：${cc.moodTone}`);
        if (cc?.chapterEnd) chapterDetailParts.push(`本章应写到：${cc.chapterEnd}`);
        if (cc?.foreshadowing) chapterDetailParts.push(`伏笔处理：${cc.foreshadowing}`);
        const outlineContext = [
          `故事背景：${skeleton.worldView.background}`,
          `主要人物：${mainChars}`,
          `当前章节：第${cc?.chapterNumber || ''}章 ${cc?.chapterTitle || ''}`,
          `章节概要：${cc?.chapterSummary || ''}`,
          ...chapterDetailParts,
        ].filter(Boolean).join('\n');
        let req = '根据故事骨架和章节规划，生成完整一章正文，约1500-2000字，情节完整有张力';
        if (customPrompt.trim()) {
          req += `。${customPrompt.trim()}`;
        }
        return {
          novel_outline: outlineContext,
          current_context: '',
          generation_requirement: req,
        };
      };

      await startBookGeneration({
        startChapterId,
        pluginId: 'novel_content_generate_1',
        buildInput,
        articleId,
        mode: bookGenMode,
      });
    },
    [skeleton, currentChapter, customPrompt, startBookGeneration, articleId, bookGenMode]
  );

  const handlePause = useCallback(() => {
    if (bookGenerating) {
      pauseTask('novel_book_generate');
    } else if (isTaskRunning('novel_chapter_generate')) {
      pauseTask('novel_chapter_generate');
    }
  }, [bookGenerating, isTaskRunning, pauseTask]);

  const handleResume = useCallback(() => {
    if (bookPauseStatus === 'paused') {
      resumeTask('novel_book_generate');
    } else if (getTaskPauseStatus('novel_chapter_generate') === 'paused') {
      resumeTask('novel_chapter_generate');
    }
  }, [bookPauseStatus, getTaskPauseStatus, resumeTask]);

  const handleStop = useCallback(() => {
    if (bookGenerating || bookPauseStatus === 'paused') {
      stopTask('novel_book_generate');
    } else if (isTaskRunning('novel_chapter_generate') || getTaskPauseStatus('novel_chapter_generate') === 'paused') {
      stopTask('novel_chapter_generate');
    }
  }, [bookGenerating, bookPauseStatus, isTaskRunning, getTaskPauseStatus, stopTask]);

  const isSingleChapterPaused = getTaskPauseStatus('novel_chapter_generate') === 'paused';
  const singleChapterStopped = getTaskPauseStatus('novel_chapter_generate') === 'stopped';

  const handleAction = useCallback(
    async (action: AIAction) => {
      if (!currentChapter || isGenerating || !action) return;
      setActiveAction(action);
      setStreamingText('');

      const chapterContent = currentChapter.content || '';

      let pluginId = 'novel_content_generate_1';
      let input: any = {};
      let isReplace = false;
      let taskType: 'novel_continue' | 'novel_polish' | 'novel_expand' = 'novel_continue';

      const outlineContext = buildOutlineContext();

      if (action === 'continue') {
        taskType = 'novel_continue';
        pluginId = 'novel_content_generate_1';
        input = {
          novel_outline: outlineContext,
          current_context: chapterContent,
          generation_requirement: '续写当前章节，承接上下文，自然推进剧情，约800-1000字',
        };
      } else if (action === 'polish') {
        taskType = 'novel_polish';
        if (!selectedText) {
          toast.info('请先选中要润色的段落');
          setActiveAction(null);
          return;
        }
        pluginId = 'novel_content_polishing_1';
        input = {
          novel_paragraph: selectedText,
        };
        isReplace = true;
      } else if (action === 'expand') {
        taskType = 'novel_expand';
        pluginId = 'novel_content_generate_1';
        const context = selectedText || chapterContent;
        input = {
          novel_outline: outlineContext,
          current_context: context,
          generation_requirement:
            selectedText && selectedText.length > 0
              ? '扩写选中的段落，丰富细节描写，增强画面感和情感表达，保持原有情节走向'
              : '在当前内容基础上进行扩写，丰富情节细节和人物描写，约500-800字',
        };
        isReplace = !!selectedText;
      }

      if (customPrompt.trim()) {
        input.generation_requirement = (input.generation_requirement || '') + `。${customPrompt.trim()}`;
      }

      const applyResult = (text: string) => {
        if (isReplace) {
          onReplaceSelection(text);
        } else {
          onInsertText(text);
        }
      };

      await startNovelGeneration(taskType, pluginId, input, currentChapter.id, applyResult, articleId);
      setActiveAction(null);
      setCustomPrompt('');
    },
    [
      currentChapter,
      isGenerating,
      selectedText,
      buildOutlineContext,
      customPrompt,
      onInsertText,
      onReplaceSelection,
      startNovelGeneration,
      articleId,
    ]
  );

  const isCurrentGenerating = useMemo(() => {
    if (!currentChapter) return false;
    return isChapterGenerating(currentChapter.id);
  }, [currentChapter, isChapterGenerating]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">AI 助手</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">智能创作辅助</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 一键生成本章 */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">一键生成</div>

          {/* 生成控制区（生成中/暂停中显示） */}
          {(chapterGenerating || isSingleChapterPaused || bookGenerating) && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs">
                {isBookPaused || isSingleChapterPaused ? (
                  <>
                    <Pause className="size-3.5 text-warning" />
                    <span className="font-medium text-warning">已暂停</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span className="font-medium text-foreground">
                      {bookGenerating
                        ? `${bookProgress ? `第 ${bookProgress.currentIndex + 1}/${bookProgress.total} 章` : '整本书生成中...'}`
                        : '整章生成中...'}
                    </span>
                  </>
                )}
              </div>
              {bookGenerating && bookProgress && (
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground truncate">
                    {bookProgress.chapterTitle}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${bookProgress.total > 0 ? ((bookProgress.currentIndex + 1) / bookProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={isBookPaused || isSingleChapterPaused ? handleResume : handlePause}
                >
                  {isBookPaused || isSingleChapterPaused ? (
                    <>
                      <Play className="size-3.5" />
                      继续
                    </>
                  ) : (
                    <>
                      <Pause className="size-3.5" />
                      暂停
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1 text-destructive hover:text-destructive"
                  onClick={handleStop}
                >
                  <Square className="size-3.5 fill-current" />
                  停止
                </Button>
              </div>
            </div>
          )}

          {/* 生成本章按钮 */}
          {!chapterGenerating && !isSingleChapterPaused && !bookGenerating && (
            <>
              <Button
                variant="default"
                size="sm"
                className="w-full gap-2"
                onClick={handleGenerateChapter}
                disabled={!currentChapter || overallGenerating || !skeleton}
              >
                <Sparkles className="size-4" />
                {currentChapter?.content && currentChapter.content.trim().length > 0
                  ? '重新生成本章'
                  : 'AI 生成本章'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleGenerateBook}
                disabled={!currentChapter || overallGenerating || !skeleton}
              >
                <BookOpen className="size-4" />
                AI 生成整本书
              </Button>
            </>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            基于故事骨架、前文内容和章节规划，自动生成章节正文
          </p>
        </div>

        {/* 生成下一章 */}
        {hasNextChapter && onGenerateNextChapter && !overallGenerating && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={onGenerateNextChapter}
            disabled={!currentChapter}
          >
            <ChevronRight className="size-4" />
            生成下一章
          </Button>
        )}

        <Separator />

        {/* 快捷操作（微调） */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">微调工具</div>
            <Badge variant="outline" className="text-[10px] font-normal">
              选中文本后可用
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="justify-start gap-2"
              onClick={() => handleAction('continue')}
              disabled={!currentChapter || overallGenerating}
            >
              {activeAction === 'continue' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              续写
              <span className="ml-auto text-xs text-muted-foreground">光标后生成</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="justify-start gap-2"
              onClick={() => handleAction('polish')}
              disabled={!currentChapter || overallGenerating || !selectedText}
            >
              {activeAction === 'polish' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              润色
              <span className="ml-auto text-xs text-muted-foreground">选中段落</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="justify-start gap-2"
              onClick={() => handleAction('expand')}
              disabled={!currentChapter || overallGenerating}
            >
              {activeAction === 'expand' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Maximize2 className="size-4" />
              )}
              扩写
              <span className="ml-auto text-xs text-muted-foreground">丰富细节</span>
            </Button>
          </div>
        </div>

        <Separator />

        {/* 自定义指令 */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">自定义指令（可选）</div>
          <Textarea
            placeholder="例如：增加环境描写、让对话更幽默、加入悬疑元素..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="min-h-[70px] resize-none text-sm"
            disabled={overallGenerating}
          />
        </div>

        <Separator />

        {/* 流式预览 */}
        <AnimatePresence>
          {(overallGenerating || streamingText) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {overallGenerating ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    {isCurrentGenerating ? '整章生成中...' : 'AI 生成中...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3 text-success" />
                    生成完成
                  </>
                )}
              </div>
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {streamingText || '正在构思...'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 章节信息 */}
        {currentChapter && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">当前章节</div>
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      第{currentChapter.chapterNumber}章
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {currentChapter.chapterTitle}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                    {currentChapter.chapterSummary}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* 故事概要 */}
        {skeleton && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">故事背景</div>
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-4">
                {skeleton.worldView.background}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 重新生成确认对话框 */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-warning" />
              重新生成章节
            </AlertDialogTitle>
            <AlertDialogDescription>
              当前章节已有内容，重新生成将覆盖现有正文。此操作不可撤销，确定继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={startGeneration}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确定重新生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
       {/* 整本书生成确认对话框 */}
      <AlertDialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              生成整本书
            </AlertDialogTitle>
            <AlertDialogDescription>
              检测到当前不是第一章，请选择生成范围和生成模式：
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {/* 生成模式选择 */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">生成模式</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBookGenMode('incremental')}
                  className={`rounded-lg border p-3 text-left text-xs transition-colors ${bookGenMode === 'incremental' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-border/80'}`}
                >
                  <div className="font-medium mb-0.5">增量生成</div>
                  <div className="text-[11px] text-muted-foreground">仅生成未生成的章节</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBookGenMode('overwrite')}
                  className={`rounded-lg border p-3 text-left text-xs transition-colors ${bookGenMode === 'overwrite' ? 'border-destructive bg-destructive/5 text-destructive' : 'border-border hover:border-border/80'}`}
                >
                  <div className="font-medium mb-0.5">覆盖重新生成</div>
                  <div className="text-[11px] text-muted-foreground">全部重新生成并覆盖</div>
                </button>
              </div>
            </div>
            <Separator />
            {/* 范围选择 */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">生成范围</div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => startBookGenerationFrom('fromCurrent')}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Play className="size-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">从本章生成到结尾</div>
                    <div className="text-xs text-muted-foreground">
                      从第 {currentIndex + 1} 章开始，共 {totalChapters - currentIndex} 章
                      {bookGenMode === 'incremental' ? '（跳过已有内容）' : '（全部覆盖）'}
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => startBookGenerationFrom('fromStart')}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <BookOpen className="size-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">从第一章重新生成全书</div>
                    <div className="text-xs text-muted-foreground">
                      从第 1 章开始，共 {totalChapters} 章
                      {bookGenMode === 'incremental' ? '（跳过已有内容）' : '（全部覆盖）'}
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
