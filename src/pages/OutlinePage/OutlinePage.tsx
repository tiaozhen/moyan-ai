import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Lightbulb, Loader2, Tag, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ICategory, IOutlineCard, NovelLengthType } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import { loadCreationState, saveCreationState, createArticle, addArticle } from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';

export default function OutlinePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<ICategory | null>(null);
  const [outlines, setOutlines] = useState<IOutlineCard[]>([]);
  const [rawText, setRawText] = useState('');
  const { startOutlineBatch, isTaskRunning, getOutlineStreamingText, tasks } = useGeneration();
  const loading = isTaskRunning('outline_batch');
  const pollRef = useRef<number | null>(null);
  // 创建文章弹窗
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pendingOutline, setPendingOutline] = useState<IOutlineCard | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleLength, setArticleLength] = useState<NovelLengthType>('medium');

  useEffect(() => {
    const state = loadCreationState();
    if (state.selectedCategory) {
      setCategory(state.selectedCategory);
    }
    if (state.outlineList && state.outlineList.length > 0) {
      setOutlines(state.outlineList);
    }
  }, []);

  // 如果后台正在生成，轮询同步流式文本
  useEffect(() => {
    if (!loading) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = window.setInterval(() => {
      const text = getOutlineStreamingText();
      setRawText(text);
    }, 150);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [loading, getOutlineStreamingText]);

  // 生成完成后读最终数据
  useEffect(() => {
    const doneTask = tasks.find((t) => t.type === 'outline_batch' && t.status === 'done');
    if (doneTask) {
      const state = loadCreationState();
      if (state.outlineList && state.outlineList.length > 0) {
        setOutlines(state.outlineList);
        setRawText('');
      }
    }
  }, [tasks]);

  const generateOutlines = useCallback(async () => {
    if (!category) {
      toast.warning('请先选择一个品类');
      navigate('/');
      return;
    }

    setOutlines([]);
    setRawText('');

    const result = await startOutlineBatch(
      category.name,
      '8个',
      '每个大纲要有独特的切入点，避免俗套，包含强悬念和反转元素',
      parseOutlines
    );
    if (result) {
      setOutlines(result);
      setRawText('');
    }
  }, [category, navigate, startOutlineBatch]);

  const handleSelectOutline = useCallback(
    (outline: IOutlineCard) => {
      setPendingOutline(outline);
      setArticleTitle(outline.title);
      setArticleLength('medium');
      setCreateDialogOpen(true);
    },
    []
  );

  const handleConfirmCreate = useCallback(() => {
    if (!pendingOutline) return;
    const state = loadCreationState();
    const title = articleTitle.trim() || pendingOutline.title;
    const article = createArticle({
      title,
      lengthType: articleLength,
      category: state.selectedCategory,
      outline: pendingOutline,
    });
    const newState = addArticle(state, article);
    // 同时记录 selectedOutline 保持兼容
    saveCreationState({ ...newState, selectedOutline: pendingOutline });
    toast.success(`已创建「${title}」`);
    setCreateDialogOpen(false);
    setPendingOutline(null);
    navigate('/expansion');
  }, [pendingOutline, articleTitle, articleLength, navigate]);

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* 顶部 */}
      <section className="mb-10 md:mb-12">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 gap-1">
          <ArrowLeft className="size-4" />
          返回品类调研
        </Button>

        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                {category && (
                  <Badge variant="secondary">当前品类：{category.name}</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">一句话故事大纲</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              基于选定品类，AI 批量生成高概念（High Concept）一句话故事点子，
              选择最打动你的那个，进入下一步骨架拓展
            </p>
          </div>
          <Button onClick={generateOutlines} disabled={loading || !category} size="lg" className="gap-2">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                AI 生成大纲
              </>
            )}
          </Button>
        </div>
      </section>

      {/* 未选品类提示 */}
      {!category && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Lightbulb className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">还没有选定品类</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            请先回到品类调研页面，选择一个你感兴趣的小说品类
          </p>
          <Button className="mt-4" onClick={handleBack}>
            去选择品类
          </Button>
        </div>
      )}

      {/* 加载中 - 流式展示 */}
      {loading && rawText && (
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            AI 正在构思故事点子...
          </div>
          <div className="whitespace-pre-line text-foreground">{rawText}</div>
        </div>
      )}

      {/* 空状态 */}
      {category && outlines.length === 0 && !loading && !rawText && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Lightbulb className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">开启创意灵感</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            点击「AI 生成大纲」，系统将基于「{category.name}」品类为你批量生成
            多个高概念一句话故事大纲
          </p>
        </div>
      )}

      {/* 大纲卡片网格 */}
      <AnimatePresence mode="wait">
        {outlines.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {outlines.map((outline, i) => (
              <motion.div
                key={outline.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                <Card className="flex h-full flex-col hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </div>
                      <CardTitle className="text-base">{outline.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm leading-relaxed text-foreground">
                      {outline.concept}
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3 border-t pt-4">
                    <div className="flex flex-wrap gap-1">
                      {outline.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="mr-1 size-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handleSelectOutline(outline)}
                      variant="default"
                    >
                      选择此大纲
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
       </AnimatePresence>

      {/* 创建文章弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              创建新文章
            </DialogTitle>
            <DialogDescription>
              基于选定的一句话大纲，创建一篇新的小说文章。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="article-title">文章标题</Label>
              <Input
                id="article-title"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="请输入文章标题"
              />
            </div>

            <div className="space-y-2">
              <Label>篇幅类型</Label>
              <RadioGroup
                value={articleLength}
                onValueChange={(v) => setArticleLength(v as NovelLengthType)}
                className="grid grid-cols-3 gap-2"
              >
                {(Object.keys(NOVEL_LENGTH_OPTIONS) as NovelLengthType[]).map((key) => {
                  const opt = NOVEL_LENGTH_OPTIONS[key];
                  return (
                    <Label
                      key={key}
                      className={`flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 transition-colors ${
                        articleLength === key
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:bg-accent/50'
                      }`}
                    >
                      <RadioGroupItem value={key} className="sr-only" />
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.wordRange}</span>
                      <span className="text-xs text-muted-foreground">{opt.chapterRange}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            {pendingOutline && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">选定大纲</div>
                <div className="text-sm font-medium">{pendingOutline.title}</div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {pendingOutline.concept}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmCreate} disabled={!articleTitle.trim()}>
              确认创建
            </Button>
          </DialogFooter>
       </DialogContent>
     </Dialog>
   </div>
 );
}

// 解析流式生成的文本为大纲卡片
function parseOutlines(text: string): IOutlineCard[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const outlines: IOutlineCard[] = [];
  let currentTitle = '';
  let currentConcept = '';

  for (const line of lines) {
    // 匹配 "数字. 标题：内容" 或 "数字. 标题-内容" 或 "数字、内容"
    const match = line.match(/^(\d+)[\.、]\s*(.+)/);
    if (match) {
      const content = match[2].trim();

      // 尝试从内容中提取标题（冒号、破折号分隔的前半部分）
      const titleMatch = content.match(/^(.+?)[：:——\-]\s*(.+)$/);
      if (titleMatch) {
        currentTitle = titleMatch[1].trim();
        currentConcept = titleMatch[2].trim();
      } else {
        // 没有明确标题，用前几个字作为标题
        currentTitle = content.slice(0, Math.min(10, content.length)) + '...';
        currentConcept = content;
      }

      // 生成标签（从概念中提取关键词）
      const tags = extractTags(currentConcept);

      outlines.push({
        id: `outline-${outlines.length + 1}`,
        title: currentTitle,
        concept: currentConcept,
        tags,
      });
    }
  }

  return outlines;
}

function extractTags(concept: string): string[] {
  const tagPool = [
    '穿越', '重生', '系统', '修仙', '都市', '玄幻', '科幻', '悬疑',
    '爱情', '复仇', '逆袭', '甜宠', '虐恋', '权谋', '种田', '无限流',
    '脑洞', '反转', '治愈', '热血', '成长', '冒险', '奇幻', '灵异',
  ];
  const found = tagPool.filter((t) => concept.includes(t));
  if (found.length === 0) {
    return ['高概念', '强悬念'];
  }
  return found.slice(0, 3);
}
