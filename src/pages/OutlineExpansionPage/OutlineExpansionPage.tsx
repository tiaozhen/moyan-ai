import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  Users,
  Globe,
  Waypoints,
  Layers,
  BookOpen,
  Check,
  Edit3,
  FileText,
  ChevronDown,
  ChevronUp,
  GripVertical,
  MapPin,
  Heart,
  Compass,
  Target,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import type { IOutlineCard, IStorySkeleton, IChapter, IChapterMeta, INovelArticle, ChapterPhase } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import {
  loadCreationState,
  saveCreationState,
  getCurrentArticle,
  updateCurrentArticle,
  setArticleSkeleton,
  setCurrentArticle,
} from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';
import ArticleSwitcher from '@/components/ArticleSwitcher';

const SECTIONS = [
  { id: 'characters', label: '人物设定', icon: Users },
  { id: 'worldview', label: '世界观', icon: Globe },
  { id: 'plot', label: '剧情节点', icon: Waypoints },
  { id: 'structure', label: '起承转合', icon: Layers },
  { id: 'chapters', label: '章节规划', icon: BookOpen },
];

export default function OutlineExpansionPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<INovelArticle[]>([]);
  const [currentArticleId, setCurrentArticleIdState] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<IStorySkeleton | null>(null);
  const [activeSection, setActiveSection] = useState('characters');
  const [editingField, setEditingField] = useState<string | null>(null);
  const { startStorySkeleton, isTaskRunning, tasks } = useGeneration();
  const loading = isTaskRunning('story_skeleton');

  const currentArticle = articles.find((a) => a.id === currentArticleId) || null;
  const outline = currentArticle?.outline || null;
  const articleLength = currentArticle?.lengthType || 'medium';

  // 加载文章列表 + 当前文章数据
  useEffect(() => {
    const state = loadCreationState();
    setArticles(state.articles);
    setCurrentArticleIdState(state.currentArticleId);
    const article = getCurrentArticle(state);
    if (article?.storySkeleton) {
      setSkeleton(article.storySkeleton);
    }
  }, []);

  // 生成完成后从当前文章读取
  useEffect(() => {
    const doneTask = tasks.find((t) => t.type === 'story_skeleton' && t.status === 'done');
    if (doneTask) {
      const state = loadCreationState();
      const article = getCurrentArticle(state);
      if (article?.storySkeleton) {
        setSkeleton(article.storySkeleton);
        setArticles(state.articles);
      }
    }
  }, [tasks]);

  // 切换文章
  const handleSwitchArticle = useCallback(
    (articleId: string) => {
      const state = loadCreationState();
      const next = setCurrentArticle(state, articleId);
      saveCreationState(next);
      setArticles(next.articles);
      setCurrentArticleIdState(next.currentArticleId);
      const article = next.articles.find((a) => a.id === articleId) || null;
      setSkeleton(article?.storySkeleton || null);
    },
    []
  );

  const generateSkeleton = useCallback(async () => {
    if (!currentArticle || !currentArticle.outline) {
      toast.warning('请先选择一句话大纲并创建文章');
      navigate('/outline');
      return;
    }

    const result = await startStorySkeleton(currentArticle.outline.concept, currentArticle.lengthType, mapApiToSkeleton);
    if (result) {
      // 写入当前文章
      const state = loadCreationState();
      const chapters: IChapter[] = result.chapterPlan.map((meta) => ({
        ...meta,
        id: meta.id,
        content: '',
        status: 'unwritten' as const,
        lastModified: Date.now(),
      }));
      const newState = setArticleSkeleton(state, result, chapters);
      saveCreationState(newState);
      setSkeleton(result);
      setArticles(newState.articles);
    }
  }, [currentArticle, navigate, startStorySkeleton]);

  const handleConfirm = useCallback(() => {
    if (!skeleton || !currentArticleId) return;
    const state = loadCreationState();

    // 只有章节列表为空时才从骨架初始化
    let chapters: IChapter[];
    const current = state.articles.find((a) => a.id === state.currentArticleId);
    if (current && current.chapters.length > 0) {
      chapters = current.chapters;
    } else {
      chapters = skeleton.chapterPlan.map((meta) => ({
        ...meta,
        id: meta.id,
        content: '',
        status: 'unwritten' as const,
        lastModified: Date.now(),
      }));
    }

    const newState = setArticleSkeleton(state, skeleton, chapters);
    saveCreationState(newState);
    toast.success('骨架已确认，开始创作吧！');
    navigate('/novel');
  }, [skeleton, currentArticleId, navigate]);

  const updateSkeleton = useCallback((updater: (prev: IStorySkeleton) => IStorySkeleton) => {
    setSkeleton((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      // 写入当前文章
      const state = loadCreationState();
      const newState = updateCurrentArticle(state, (a) => ({
        ...a,
        storySkeleton: next,
      }));
      saveCreationState(newState);
      setArticles(newState.articles);
      return next;
    });
  }, []);

  const sectionCounts = useMemo(() => {
    if (!skeleton)
      return { characters: 0, worldview: 0, plot: 0, structure: 0, chapters: 0 };
    return {
      characters: skeleton.characterSettings.length,
      worldview: 1,
      plot: skeleton.plotNodes.length,
      structure: 4,
      chapters: skeleton.chapterPlan.length,
    };
  }, [skeleton]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      {/* 顶部标题区 */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/outline')} className="gap-1">
            <ArrowLeft className="size-4" />
            返回一句话大纲
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">故事骨架拓展</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              AI 将一句话大纲拓展为完整的故事架构，涵盖人物、世界观、剧情节点和章节规划，
              你可以直接编辑微调
            </p>
          </div>
        </div>
        <ArticleSwitcher
          articles={articles}
          currentArticleId={currentArticleId}
          onSwitch={handleSwitchArticle}
        />
      </div>

      {/* 无文章空状态 */}
      {!currentArticle && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <FileText className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">暂无文章</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            请先前往一句话大纲页面，选择一个故事点子并创建文章
          </p>
          <Button className="mt-4" onClick={() => navigate('/outline')}>
            去创建文章
          </Button>
        </div>
      )}

      {/* 有文章但还没生成骨架 */}
      {currentArticle && !skeleton && !loading && (
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">开始生成故事骨架</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                AI 将基于一句话大纲，为你生成完整的故事架构（人物设定、世界观、剧情节点、起承转合、章节规划）。
                篇幅类型：{NOVEL_LENGTH_OPTIONS[articleLength].label}（{NOVEL_LENGTH_OPTIONS[articleLength].chapterRange}）
              </p>
              {currentArticle.outline && (
                <div className="mt-4 rounded-lg bg-muted/50 p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">当前大纲</div>
                  <div className="text-sm font-medium">{currentArticle.outline.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {currentArticle.outline.concept}
                  </p>
                </div>
              )}
              <Button onClick={generateSkeleton} disabled={loading} className="mt-4 gap-2">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    AI 生成骨架
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 加载中 */}
      {loading && !skeleton && (
        <div className="rounded-xl border border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
          <h3 className="text-lg font-medium">正在生成故事骨架</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            AI 正在为你构建完整的故事架构，请稍候...
          </p>
        </div>
      )}
      {/* 骨架内容 */}
      {skeleton && !loading && (
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* 左侧结构导航 */}
          <aside className="lg:sticky lg:top-24 lg:h-fit lg:w-56 lg:shrink-0">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {SECTIONS.map((s) => {
                    const Icon = s.icon;
                    const count = sectionCounts[s.id as keyof typeof sectionCounts] || 0;
                    return (
                      <button
                        key={s.id}
                        onClick={() => scrollToSection(s.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          activeSection === s.id
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        }`}
                      >
                        <Icon className="size-4" />
                        <span className="flex-1">{s.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {count}
                        </Badge>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* 右侧编辑区 */}
          <div className="flex-1 space-y-8">
            {/* 人物设定 */}
            <section id="section-characters" className="scroll-mt-24">
              <SectionHeader
                icon={<Users className="size-5" />}
                title="人物设定"
                subtitle="故事中的主要角色及其设定"
                onEdit={() => setEditingField('characters')}
                isEditing={editingField === 'characters'}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {skeleton.characterSettings.map((char, idx) => (
                  <motion.div
                    key={char.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{char.name}</CardTitle>
                          <Badge variant="secondary">{char.identity}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <EditableField
                          label="性格特点"
                          value={char.personality}
                          fieldKey={`char-personality-${char.id}`}
                          editingField={editingField}
                          onSave={(v) =>
                            updateSkeleton((prev) => ({
                              ...prev,
                              characterSettings: prev.characterSettings.map((c) =>
                                c.id === char.id ? { ...c, personality: v } : c
                              ),
                            }))
                          }
                        />
                        <EditableField
                          label="核心诉求"
                          value={char.coreDemand}
                          fieldKey={`char-demand-${char.id}`}
                          editingField={editingField}
                          onSave={(v) =>
                            updateSkeleton((prev) => ({
                              ...prev,
                              characterSettings: prev.characterSettings.map((c) =>
                                c.id === char.id ? { ...c, coreDemand: v } : c
                              ),
                            }))
                          }
                        />
                        <EditableField
                          label="人物弧光"
                          value={char.characterArc}
                          fieldKey={`char-arc-${char.id}`}
                          editingField={editingField}
                          onSave={(v) =>
                            updateSkeleton((prev) => ({
                              ...prev,
                              characterSettings: prev.characterSettings.map((c) =>
                                c.id === char.id ? { ...c, characterArc: v } : c
                              ),
                            }))
                          }
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* 世界观设定 */}
            <section id="section-worldview" className="scroll-mt-24">
              <SectionHeader
                icon={<Globe className="size-5" />}
                title="世界观设定"
                subtitle="故事发生的世界背景与规则"
                onEdit={() => setEditingField('worldview')}
                isEditing={editingField === 'worldview'}
              />
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <EditableField
                    label="时代/世界背景"
                    value={skeleton.worldView.background}
                    fieldKey="world-bg"
                    editingField={editingField}
                    onSave={(v) =>
                      updateSkeleton((prev) => ({
                        ...prev,
                        worldView: { ...prev.worldView, background: v },
                      }))
                    }
                  />
                  <Separator />
                  <EditableField
                    label="世界运行规则"
                    value={skeleton.worldView.rules}
                    fieldKey="world-rules"
                    editingField={editingField}
                    onSave={(v) =>
                      updateSkeleton((prev) => ({
                        ...prev,
                        worldView: { ...prev.worldView, rules: v },
                      }))
                    }
                  />
                  <Separator />
                  <EditableField
                    label="核心冲突环境"
                    value={skeleton.worldView.coreConflictEnvironment}
                    fieldKey="world-conflict"
                    editingField={editingField}
                    onSave={(v) =>
                      updateSkeleton((prev) => ({
                        ...prev,
                        worldView: { ...prev.worldView, coreConflictEnvironment: v },
                      }))
                    }
                  />
                </CardContent>
              </Card>
            </section>

            {/* 剧情节点 */}
            <section id="section-plot" className="scroll-mt-24">
              <SectionHeader
                icon={<Waypoints className="size-5" />}
                title="主线剧情节点"
                subtitle="推动故事发展的关键事件"
                onEdit={() => setEditingField('plot')}
                isEditing={editingField === 'plot'}
              />
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-0">
                    {skeleton.plotNodes.map((node, idx) => (
                      <div key={node.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              node.importance === '高'
                                ? 'bg-primary text-primary-foreground'
                                : node.importance === '中'
                                  ? 'bg-secondary text-secondary-foreground'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          {idx < skeleton.plotNodes.length - 1 && (
                            <div className="mt-2 w-px flex-1 bg-border" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{node.nodeName}</h4>
                            <Badge
                              variant={
                                node.importance === '高'
                                  ? 'default'
                                  : node.importance === '中'
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="text-xs"
                            >
                              {node.importance}
                            </Badge>
                          </div>
                          <EditableField
                            label=""
                            value={node.nodeContent}
                            fieldKey={`plot-${node.id}`}
                            editingField={editingField}
                            onSave={(v) =>
                              updateSkeleton((prev) => ({
                                ...prev,
                                plotNodes: prev.plotNodes.map((p) =>
                                  p.id === node.id ? { ...p, nodeContent: v } : p
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 起承转合 */}
            <section id="section-structure" className="scroll-mt-24">
              <SectionHeader
                icon={<Layers className="size-5" />}
                title="起承转合结构"
                subtitle="故事整体的叙事节奏框架"
                onEdit={() => setEditingField('structure')}
                isEditing={editingField === 'structure'}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <StructureCard
                  phase="起"
                  phaseLabel="开端"
                  description="故事背景与人物引入"
                  content={skeleton.narrativeStructure.opening}
                  color="bg-blue-500"
                  fieldKey="struct-opening"
                  editingField={editingField}
                  onSave={(v) =>
                    updateSkeleton((prev) => ({
                      ...prev,
                      narrativeStructure: { ...prev.narrativeStructure, opening: v },
                    }))
                  }
                />
                <StructureCard
                  phase="承"
                  phaseLabel="发展"
                  description="冲突升级与事件展开"
                  content={skeleton.narrativeStructure.development}
                  color="bg-green-500"
                  fieldKey="struct-development"
                  editingField={editingField}
                  onSave={(v) =>
                    updateSkeleton((prev) => ({
                      ...prev,
                      narrativeStructure: { ...prev.narrativeStructure, development: v },
                    }))
                  }
                />
                <StructureCard
                  phase="转"
                  phaseLabel="高潮"
                  description="核心冲突爆发与抉择"
                  content={skeleton.narrativeStructure.climax}
                  color="bg-orange-500"
                  fieldKey="struct-climax"
                  editingField={editingField}
                  onSave={(v) =>
                    updateSkeleton((prev) => ({
                      ...prev,
                      narrativeStructure: { ...prev.narrativeStructure, climax: v },
                    }))
                  }
                />
                <StructureCard
                  phase="合"
                  phaseLabel="结局"
                  description="冲突解决与故事收尾"
                  content={skeleton.narrativeStructure.ending}
                  color="bg-purple-500"
                  fieldKey="struct-ending"
                  editingField={editingField}
                  onSave={(v) =>
                    updateSkeleton((prev) => ({
                      ...prev,
                      narrativeStructure: { ...prev.narrativeStructure, ending: v },
                    }))
                  }
                />
              </div>
            </section>

            {/* 章节规划 */}
            <section id="section-chapters" className="scroll-mt-24">
              <SectionHeader
                icon={<BookOpen className="size-5" />}
                title="章节规划"
                subtitle={`全书共 ${skeleton.chapterPlan.length} 章，点击卡片展开查看详细设定${editingField === 'chapters' ? '（编辑模式）' : ''}`}
                onEdit={() => setEditingField('chapters')}
                isEditing={editingField === 'chapters'}
              />

              {/* 起承转合节奏总览 */}
              <div className="mb-6 grid grid-cols-4 gap-2 md:gap-3">
                {[
                  { phase: '铺垫', color: 'bg-blue-500', label: '起·铺垫' },
                  { phase: '发展', color: 'bg-green-500', label: '承·发展' },
                  { phase: '高潮', color: 'bg-orange-500', label: '转·高潮' },
                  { phase: '收尾', color: 'bg-purple-500', label: '合·收尾' },
                ].map((p) => {
                  const count = skeleton.chapterPlan.filter((c) => c.phase === p.phase).length;
                  return (
                    <div key={p.phase} className="rounded-lg border border-border/50 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <div className={`size-2 rounded-full ${p.color}`} />
                        <span className="text-xs font-medium text-muted-foreground">{p.label}</span>
                      </div>
                      <div className="mt-1 text-xl font-bold text-foreground">{count}<span className="ml-1 text-xs font-normal text-muted-foreground">章</span></div>
                    </div>
                  );
                })}
              </div>

              <Accordion type="single" collapsible className="w-full space-y-2">
                {skeleton.chapterPlan.map((ch, idx) => (
                  <ChapterPlanCard
                    key={ch.id}
                    chapter={ch}
                    index={idx}
                    isEditing={editingField === 'chapters'}
                    onUpdate={(updates) =>
                      updateSkeleton((prev) => ({
                        ...prev,
                        chapterPlan: prev.chapterPlan.map((c) =>
                          c.id === ch.id ? { ...c, ...updates } : c
                        ),
                      }))
                    }
                  />
                ))}
              </Accordion>
            </section>

            {/* 底部确认按钮 */}
            <div className="sticky bottom-4 z-30 flex justify-end">
              <Button onClick={handleConfirm} size="lg" className="gap-2 shadow-lg">
                <Check className="size-4" />
                确认骨架，开始创作
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  onEdit,
  isEditing,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onEdit: () => void;
  isEditing: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Button
        variant={isEditing ? 'default' : 'ghost'}
        size="sm"
        onClick={onEdit}
        className="gap-1"
      >
        <Edit3 className="size-4" />
        {isEditing ? '完成编辑' : '编辑'}
      </Button>
    </div>
  );
}

function EditableField({
  label,
  value,
  fieldKey,
  editingField,
  onSave,
  isTitle = false,
}: {
  label: string;
  value: string;
  fieldKey: string;
  editingField: string | null;
  onSave: (val: string) => void;
  isTitle?: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  const isEditMode = editingField !== null;

  if (!isEditMode) {
    if (isTitle) {
      return (
        <div>
          {label && <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>}
          <div className="font-medium text-foreground">{value}</div>
        </div>
      );
    }
    return (
      <div>
        {label && <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>}
        <div className={`text-foreground ${isTitle ? 'font-medium' : 'text-sm leading-relaxed'}`}>
          {value}
        </div>
      </div>
    );
  }

  const needsTextarea = value.length > 60 || isTitle === false;

  return (
    <div>
      {label && <Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>}
      {needsTextarea ? (
        <Textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onSave(localValue)}
          className="min-h-[80px] resize-y text-sm leading-relaxed"
        />
      ) : (
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onSave(localValue)}
          className="text-sm"
        />
      )}
    </div>
  );
}

function StructureCard({
  phase,
  phaseLabel,
  description,
  content,
  color,
  fieldKey,
  editingField,
  onSave,
}: {
  phase: string;
  phaseLabel: string;
  description: string;
  content: string;
  color: string;
  fieldKey: string;
  editingField: string | null;
  onSave: (v: string) => void;
}) {
  const [localValue, setLocalValue] = useState(content);
  const isEditMode = editingField !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-lg text-lg font-bold text-white ${color}`}>
            {phase}
          </div>
          <div>
            <CardTitle className="text-base">{phaseLabel}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditMode ? (
          <Textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onSave(localValue)}
            className="min-h-[120px] resize-y text-sm leading-relaxed"
          />
        ) : (
          <p className="text-sm leading-relaxed text-foreground">{content}</p>
        )}
      </CardContent>
    </Card>
  );
}

function mapApiToSkeleton(api: any): IStorySkeleton {
  const characters =
    api.character_settings?.map((c: any, i: number) => ({
      id: `char-${i}`,
      name: c.name || `角色${i + 1}`,
      identity: c.identity || '',
      personality: c.personality || '',
      coreDemand: c.core_demand || '',
      characterArc: c.character_arc || '',
    })) || [];

  const worldView = {
    background: api.world_view?.background || '',
    rules: api.world_view?.rules || '',
    coreConflictEnvironment: api.world_view?.core_conflict_environment || '',
  };

  const plotNodes =
    api.plot_nodes?.map((p: any, i: number) => ({
      id: `plot-${i}`,
      nodeName: p.node_name || `节点${i + 1}`,
      nodeContent: p.node_content || '',
      importance: p.importance || '中',
    })) || [];

  const narrativeStructure = {
    opening: api.narrative_structure?.opening || '',
    development: api.narrative_structure?.development || '',
    climax: api.narrative_structure?.climax || '',
    ending: api.narrative_structure?.ending || '',
  };

  const chapterPlan =
    api.chapter_plan?.map((c: any, i: number) => ({
      id: `ch-${i}`,
      chapterNumber: c.chapter_number || String(i + 1),
      chapterTitle: c.chapter_title || `第${i + 1}章`,
      chapterSummary: c.chapter_summary || '',
      coreEvent: c.core_event || '',
      characters: c.characters || '',
      sceneLocation: c.scene_location || '',
      moodTone: c.mood_tone || '',
      chapterStart: c.chapter_start || '',
      chapterEnd: c.chapter_end || '',
      foreshadowing: c.foreshadowing || '',
      phase: (c.phase as ChapterPhase) || '发展',
    })) || [];

  return {
    characterSettings: characters,
    worldView,
    plotNodes,
    narrativeStructure,
    chapterPlan,
  };
}

const PHASE_COLORS: Record<ChapterPhase, string> = {
  铺垫: 'bg-blue-500',
  发展: 'bg-green-500',
  高潮: 'bg-orange-500',
  收尾: 'bg-purple-500',
};

interface ChapterPlanCardProps {
  chapter: IChapterMeta & { phase: ChapterPhase };
  index: number;
  isEditing: boolean;
  onUpdate: (updates: Partial<IChapterMeta & { phase: ChapterPhase }>) => void;
}

function ChapterPlanCard({ chapter, index, isEditing, onUpdate }: ChapterPlanCardProps) {
  const phaseColor = PHASE_COLORS[chapter.phase] || 'bg-muted-foreground';

  const FieldRow = ({ icon: Icon, label, value, fieldKey, multiline = false }: {
    icon: any;
    label: string;
    value: string;
    fieldKey: keyof IChapterMeta;
    multiline?: boolean;
  }) => {
    if (!isEditing) {
      if (!value) return null;
      return (
        <div className="flex gap-2 text-sm">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div className="text-foreground leading-relaxed">{value}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" />{label}
        </Label>
        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => onUpdate({ [fieldKey]: e.target.value } as any)}
            className="min-h-[60px] resize-y text-sm"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onUpdate({ [fieldKey]: e.target.value } as any)}
            className="text-sm"
          />
        )}
      </div>
    );
  };

  return (
    <AccordionItem value={chapter.id} className="rounded-lg border border-border/60 bg-card px-4 shadow-sm first:mt-0">
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex w-full items-center gap-3 pr-2 text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {chapter.chapterNumber || index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-foreground">{chapter.chapterTitle}</span>
              <Badge variant="outline" className={`shrink-0 border-0 text-[10px] text-white ${phaseColor}`}>
                {chapter.phase}
              </Badge>
            </div>
            {chapter.coreEvent && (
              <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{chapter.coreEvent}</div>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pb-4">
          {isEditing && (
            <div className="flex items-center gap-3 rounded-md bg-muted/40 p-2">
              <span className="text-xs font-medium text-muted-foreground">剧情阶段</span>
              <Select value={chapter.phase} onValueChange={(v) => onUpdate({ phase: v as ChapterPhase })}>
                <SelectTrigger className="h-8 flex-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="铺垫">起·铺垫</SelectItem>
                  <SelectItem value="发展">承·发展</SelectItem>
                  <SelectItem value="高潮">转·高潮</SelectItem>
                  <SelectItem value="收尾">合·收尾</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <FieldRow icon={FileText} label="章节概要" value={chapter.chapterSummary} fieldKey="chapterSummary" multiline />
          <FieldRow icon={Target} label="核心事件" value={chapter.coreEvent} fieldKey="coreEvent" multiline />
          <FieldRow icon={Users} label="出场人物" value={chapter.characters} fieldKey="characters" multiline />
          <FieldRow icon={MapPin} label="场景地点" value={chapter.sceneLocation} fieldKey="sceneLocation" />
          <FieldRow icon={Heart} label="情绪基调" value={chapter.moodTone} fieldKey="moodTone" />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldRow icon={Compass} label="本章起点" value={chapter.chapterStart} fieldKey="chapterStart" multiline />
            <FieldRow icon={TrendingUp} label="本章终点" value={chapter.chapterEnd} fieldKey="chapterEnd" multiline />
          </div>

          <FieldRow icon={Lightbulb} label="关键伏笔/悬念" value={chapter.foreshadowing} fieldKey="foreshadowing" multiline />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
