import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Wand2,
  Maximize2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { capabilityClient, logger } from '@lark-apaas/client-toolkit-lite';
import type { IChapter, IStorySkeleton } from '@/data/novel';

interface AIAssistantPanelProps {
  currentChapter: IChapter | null;
  skeleton: IStorySkeleton | null;
  selectedText: string;
  onInsertText: (text: string) => void;
  onReplaceSelection: (text: string) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
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
}: AIAssistantPanelProps) {
  const [activeAction, setActiveAction] = useState<AIAction>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

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
      if (!currentChapter || isGenerating) return;
      setActiveAction(action);
      setIsGenerating(true);
      setStreamingText('');

      const chapterContent = currentChapter.content || '';

      let pluginId = 'novel_content_generate_1';
      let input: any = {};
      let isReplace = false;

      const outlineContext = buildOutlineContext();

      if (action === 'continue') {
        // 续写：基于光标位置之后生成
        pluginId = 'novel_content_generate_1';
        input = {
          novel_outline: outlineContext,
          current_context: chapterContent,
          generation_requirement: '续写当前章节，承接上下文，自然推进剧情，约800-1000字',
        };
      } else if (action === 'polish') {
        // 润色：基于选中文本
        if (!selectedText) {
          toast.info('请先选中要润色的段落');
          setIsGenerating(false);
          setActiveAction(null);
          return;
        }
        pluginId = 'novel_content_polishing_1';
        input = {
          novel_paragraph: selectedText,
        };
        isReplace = true;
      } else if (action === 'expand') {
        // 扩写：基于选中文本或光标位置
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

      try {
        const stream = capabilityClient.load(pluginId).callStream('textGenerate', input);
        let full = '';

        for await (const chunk of stream as any) {
          const piece = chunk.content ?? chunk.response ?? '';
          if (piece) {
            full += piece;
            setStreamingText(full);
          }
        }

        // 流式结束，插入或替换
        if (full) {
          if (isReplace) {
            onReplaceSelection(full);
          } else {
            onInsertText(full);
          }
          toast.success(action === 'polish' ? '润色完成' : action === 'expand' ? '扩写完成' : '续写完成');
        }
      } catch (err) {
        logger.error('AI 生成失败:', String(err));
        toast.error('AI 生成失败，请重试');
      } finally {
        setIsGenerating(false);
        setActiveAction(null);
        setCustomPrompt('');
      }
    },
    [
      currentChapter,
      isGenerating,
      selectedText,
      buildOutlineContext,
      onInsertText,
      onReplaceSelection,
      customPrompt,
      setIsGenerating,
    ]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">AI 助手</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">智能创作辅助</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 快捷操作 */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">快捷操作</div>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="default"
              size="sm"
              className="justify-start gap-2"
              onClick={() => handleAction('continue')}
              disabled={!currentChapter || isGenerating}
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
              disabled={!currentChapter || isGenerating}
            >
              {activeAction === 'polish' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              润色
              <span className="ml-auto text-xs text-muted-foreground">选中文本</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="justify-start gap-2"
              onClick={() => handleAction('expand')}
              disabled={!currentChapter || isGenerating}
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
            className="min-h-[80px] resize-none text-sm"
          />
        </div>

        <Separator />

        {/* 流式预览 */}
        <AnimatePresence>
          {(isGenerating || streamingText) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {isGenerating ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    AI 生成中...
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
    </div>
  );
}
