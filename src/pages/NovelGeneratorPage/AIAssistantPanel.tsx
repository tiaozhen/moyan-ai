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
}

type AIAction = 'continue' | 'polish' | 'expand' | null;

// 构建整章生成需要的完整上下文
function buildChapterGenerationContext(
  chapter: IChapter,
  skeleton: IStorySkeleton | null,
  allChapters: IChapter[]
): { novel_outline: string; current_context: string; generation_requirement: string } {
  const idx = allChapters.findIndex((c) => c.id === chapter.id);
  const prevChapters = allChapters.slice(0, idx);

  // 故事骨架部分
  const skeletonParts: string[] = [];
  if (skeleton) {
    const chars = skeleton.characterSettings
      .slice(0, 5)
      .map((c) => `${c.name}（${c.identity}）：${c.personality || c.coreDemand || ''}`)
      .join('；');
    if (chars) skeletonParts.push(`主要人物：${chars}`);
    if (skeleton.worldView?.background) {
      skeletonParts.push(`世界观背景：${skeleton.worldView.background}`);
    }
  }

  // 前文摘要（前面章节正文摘要，避免超长）
  let prevContext = '';
  if (prevChapters.length > 0) {
    const prevTexts: string[] = [];
    let totalLen = 0;
    for (let i = prevChapters.length - 1; i >= 0; i--) {
      const ch = prevChapters[i];
      const plain = ch.content.replace(/<[^>]+>/g, '').trim();
      if (!plain) continue;
      // 最近 3 章保留全文摘要，更早的只留标题
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
    prevContext = prevTexts.join('\n\n');
  }

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

  return {
    novel_outline: skeletonParts.join('\n'),
    current_context: prevContext,
    generation_requirement: generationRequirement,
  };
}

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
}: AIAssistantPanelProps) {
  const [activeAction, setActiveAction] = useState<AIAction>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const {
    startNovelGeneration,
    getNovelStreamingText,
    isTaskRunning,
    startChapterGeneration,
    getChapterStreamingText,
    isChapterGenerating,
    getGeneratingChapterId,
  } = useGeneration();
  const pollRef = useRef<number | null>(null);

  const chapterGenerating =
    isTaskRunning('novel_chapter_generate') &&
    currentChapter &&
    isChapterGenerating(currentChapter.id);

  const anyNovelTaskRunning =
    isTaskRunning('novel_continue') ||
    isTaskRunning('novel_polish') ||
    isTaskRunning('novel_expand');

  // 整体生成中状态（包括整章生成）
  const overallGenerating = isGenerating || isTaskRunning('novel_chapter_generate');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, skeleton, chapterGenerating]);

  const startGeneration = useCallback(async () => {
    if (!currentChapter || !skeleton) return;

    const state = loadCreationState();
    const input = buildChapterGenerationContext(currentChapter, skeleton, state.chapters);

    // 加上用户自定义指令
    if (customPrompt.trim()) {
      input.generation_requirement += `\n额外要求：${customPrompt.trim()}`;
    }

    await startChapterGeneration({
      chapterId: currentChapter.id,
      pluginId: 'novel_content_generate_1',
      input,
    });
    setCustomPrompt('');
  }, [currentChapter, skeleton, customPrompt, startChapterGeneration]);

  const buildOutlineContext = useCallback(() => {
    if (!skeleton) return '';
    const mainChars = skeleton.characterSettings
      .slice(0, 3)
      .map((c) => `${c.name}（${c.identity}）`)
      .join('、');
    return `故事背景：${skeleton.worldView.background}\n主要人物：${mainChars}\n当前章节：${currentChapter?.chapterTitle || ''}\n章节概要：${currentChapter?.chapterSummary || ''}`;
  }, [skeleton, currentChapter]);

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

      await startNovelGeneration(taskType, pluginId, input, currentChapter.id, applyResult);
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
          <Button
            variant="default"
            size="sm"
            className="w-full gap-2"
            onClick={handleGenerateChapter}
            disabled={!currentChapter || overallGenerating || !skeleton}
          >
            {isCurrentGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                正在生成本章...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {currentChapter?.content && currentChapter.content.trim().length > 0
                  ? '重新生成本章'
                  : 'AI 生成本章'}
              </>
            )}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            基于故事骨架、前文内容和章节规划，自动生成完整一章正文
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
    </div>
  );
}
