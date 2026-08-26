import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Users,
  Globe,
  Waypoints,
  Layers,
  BookOpen,
  Edit3,
  FileText,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import type { IStorySkeleton, IChapter, INovelArticle } from '@/data/novel';
import {
  loadCreationState,
  saveCreationState,
  getCurrentArticle,
  updateCurrentArticle,
  setArticleSkeleton,
} from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';

const SECTIONS = [
  { id: 'characters', label: '人物设定', icon: Users },
  { id: 'worldview', label: '世界观', icon: Globe },
  { id: 'plot', label: '剧情节点', icon: Waypoints },
  { id: 'structure', label: '起承转合', icon: Layers },
  { id: 'chapters', label: '章节规划', icon: BookOpen },
];

export default function BookOutlineTab() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<INovelArticle | null>(null);
  const [skeleton, setSkeleton] = useState<IStorySkeleton | null>(null);
  const [activeSection, setActiveSection] = useState('characters');
  const [editingField, setEditingField] = useState<string | null>(null);
  const { startStorySkeleton, isTaskRunning } = useGeneration();
  const loading = isTaskRunning('story_skeleton');

  // 加载当前文章数据
  useEffect(() => {
    const state = loadCreationState();
    const found = state.articles.find((a) => a.id === bookId) || null;
    setArticle(found);
    if (found?.storySkeleton) {
      setSkeleton(found.storySkeleton);
    } else {
      setSkeleton(null);
    }
  }, [bookId]);

  // 轮询：骨架生成完成后读取最新数据
  useEffect(() => {
    if (loading) return;
    const state = loadCreationState();
    const found = state.articles.find((a) => a.id === bookId) || null;
    if (found?.storySkeleton && (!skeleton || skeleton !== found.storySkeleton)) {
      setSkeleton(found.storySkeleton);
      setArticle(found);
    }
  }, [loading, bookId, skeleton]);

  const generateSkeleton = useCallback(async () => {
    if (!article || !article.outline) {
      toast.warning('请先选择一句话大纲');
      navigate('/outline');
      return;
    }

    const result = await startStorySkeleton(article.outline.concept, article.lengthType, mapApiToSkeleton);
    if (result) {
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
      const updated = newState.articles.find((a) => a.id === bookId) || null;
      setArticle(updated);
    }
  }, [article, navigate, startStorySkeleton, bookId]);

  const updateSkeleton = useCallback(
    (updater: (prev: IStorySkeleton) => IStorySkeleton) => {
      setSkeleton((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        const state = loadCreationState();
        const newState = updateCurrentArticle(state, (a) => ({
          ...a,
          storySkeleton: next,
        }));
        saveCreationState(newState);
        const updated = newState.articles.find((a) => a.id === bookId) || null;
        setArticle(updated);
        return next;
      });
    },
    [bookId]
  );

  const handleGoToEditor = useCallback(() => {
    if (!skeleton || !bookId) return;
    // 确保章节列表已初始化
    const state = loadCreationState();
    const current = state.articles.find((a) => a.id === bookId);
    if (current) {
      let chapters: IChapter[];
      if (current.chapters.length > 0) {
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
    }
    navigate(`/books/${bookId}/editor`);
  }, [skeleton, bookId, navigate]);

  const sectionCounts = useMemo(() => {
    if (!skeleton) return { characters: 0, worldview: 0, plot: 0, structure: 0, chapters: 0 };
    return {
      characters: skeleton.characterSettings.length,
      worldview: 1,
      plot: skeleton.plotNodes.length,
      structure: 4,
      chapters: skeleton.chapterPlan.length,
    };
  }, [skeleton]);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const addCharacter = () => {
    updateSkeleton((prev) => ({
      ...prev,
      characterSettings: [
        ...prev.characterSettings,
        { id: `char_${Date.now()}`, name: '新角色', identity: '', personality: '', coreDemand: '', characterArc: '' },
      ],
    }));
  };

  const updateCharacter = (id: string, field: string, value: string) => {
    updateSkeleton((prev) => ({
      ...prev,
      characterSettings: prev.characterSettings.map((c) =>
        c.id === id ? { ...(c as any), [field]: value } : c
      ),
    }));
  };

  const removeCharacter = (id: string) => {
    updateSkeleton((prev) => ({
      ...prev,
      characterSettings: prev.characterSettings.filter((c) => c.id !== id),
    }));
  };

  const addPlotNode = () => {
    updateSkeleton((prev) => ({
      ...prev,
      plotNodes: [
        ...prev.plotNodes,
        { id: `plot_${Date.now()}`, nodeName: '新节点', nodeContent: '', importance: '中' },
      ],
    }));
  };

  const updatePlotNode = (id: string, field: string, value: string) => {
    updateSkeleton((prev) => ({
      ...prev,
      plotNodes: prev.plotNodes.map((p) =>
        p.id === id ? { ...(p as any), [field]: value } : p
      ),
    }));
  };

  const removePlotNode = (id: string) => {
    updateSkeleton((prev) => ({
      ...prev,
      plotNodes: prev.plotNodes.filter((p) => p.id !== id),
    }));
  };

  if (!article) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-20 text-center">
        <BookOpen className="mb-4 size-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左侧导航 */}
        <aside className="w-full shrink-0 lg:w-56">
          <div className="sticky top-20 space-y-1">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollTo(section.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {section.label}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {sectionCounts[section.id as keyof typeof sectionCounts]}
                  </Badge>
                </button>
              );
            })}
          </div>
        </aside>

        {/* 右侧主内容 */}
        <div className="flex-1 min-w-0">
          {/* 顶部操作区 */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">故事骨架</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                基于一句话大纲自动生成完整故事骨架，支持编辑微调
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={generateSkeleton} disabled={loading || !article.outline} className="gap-2">
                {loading ? (
                  <Lightbulb className="size-4 animate-pulse" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {skeleton ? '重新生成骨架' : 'AI 生成骨架'}
              </Button>
              {skeleton && (
                <Button
                  onClick={handleGoToEditor}
                  className="gap-2"
                >
                  <FileText className="size-4" />
                  开始创作
                </Button>
              )}
            </div>
          </div>

          {/* 一句话大纲概览 */}
          <Card className="mb-6 bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="text-xs font-medium text-primary mb-1">一句话大纲</div>
              <div className="text-sm font-medium">{article.outline?.title || '未选择大纲'}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {article.outline?.concept || '请先回到一句话大纲页面选择大纲'}
              </p>
            </CardContent>
          </Card>

          {/* 空状态 */}
          {!skeleton && !loading && (
            <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Layers className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium">还没有故事骨架</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                点击「AI 生成骨架」，系统将基于一句话大纲生成完整的人物设定、世界观和章节规划
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={generateSkeleton}
                disabled={!article.outline}
              >
                <Sparkles className="size-4" />
                AI 生成骨架
              </Button>
            </div>
          )}

          {/* 骨架编辑区 */}
          {skeleton && (
            <div className="space-y-6">
              {/* 人物设定 */}
              <section id="section-characters" className="scroll-mt-20">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="size-5 text-primary" />
                      人物设定
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={addCharacter} className="gap-1">
                      <Edit3 className="size-3.5" />
                      添加角色
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Accordion type="multiple" defaultValue={skeleton.characterSettings.slice(0, 2).map((c) => c.id)}>
                      {skeleton.characterSettings.map((char, idx) => (
                        <AccordionItem key={char.id} value={char.id} className="border rounded-lg px-3 mb-2">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                              <Badge variant="outline" className="text-xs">角色 {idx + 1}</Badge>
                              <span className="font-medium">{(char as any).name}</span>
                              <span className="text-xs text-muted-foreground">{(char as any).identity}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2 pt-1 pb-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">姓名</Label>
                                <Input
                                  className="h-8 text-sm"
                                  value={(char as any).name}
                                  onChange={(e) => updateCharacter(char.id, 'name', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">身份定位</Label>
                                <Input
                                  className="h-8 text-sm"
                                  value={(char as any).identity}
                                  onChange={(e) => updateCharacter(char.id, 'identity', e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">性格特质</Label>
                              <Textarea
                                value={(char as any).personality}
                                onChange={(e) => updateCharacter(char.id, 'personality', e.target.value)}
                                className="min-h-[60px] resize-none text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">核心需求</Label>
                              <Textarea
                                value={(char as any).coreDemand}
                                onChange={(e) => updateCharacter(char.id, 'coreDemand', e.target.value)}
                                className="min-h-[50px] resize-none text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">人物弧光</Label>
                              <Textarea
                                value={(char as any).characterArc}
                                onChange={(e) => updateCharacter(char.id, 'characterArc', e.target.value)}
                                className="min-h-[50px] resize-none text-sm"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCharacter(char.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              删除此角色
                            </Button>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </section>

              {/* 世界观 */}
              <section id="section-worldview" className="scroll-mt-20">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Globe className="size-5 text-primary" />
                      世界观设定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">时代背景</Label>
                      <Textarea
                        value={skeleton.worldView.background}
                        onChange={(e) =>
                          updateSkeleton((prev) => ({
                            ...prev,
                            worldView: { ...prev.worldView, background: e.target.value },
                          }))
                        }
                        className="min-h-[70px] resize-none text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">规则设定</Label>
                      <Textarea
                        value={skeleton.worldView.rules}
                        onChange={(e) =>
                          updateSkeleton((prev) => ({
                            ...prev,
                            worldView: { ...prev.worldView, rules: e.target.value },
                          }))
                        }
                        className="min-h-[70px] resize-none text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">核心冲突环境</Label>
                      <Textarea
                        value={skeleton.worldView.coreConflictEnvironment}
                        onChange={(e) =>
                          updateSkeleton((prev) => ({
                            ...prev,
                            worldView: { ...prev.worldView, coreConflictEnvironment: e.target.value },
                          }))
                        }
                        className="min-h-[70px] resize-none text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* 剧情节点 */}
              <section id="section-plot" className="scroll-mt-20">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Waypoints className="size-5 text-primary" />
                      主线剧情节点
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={addPlotNode} className="gap-1">
                      <Edit3 className="size-3.5" />
                      添加节点
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Accordion type="multiple" defaultValue={skeleton.plotNodes.slice(0, 2).map((p) => p.id)}>
                      {skeleton.plotNodes.map((node, idx) => (
                        <AccordionItem key={node.id} value={node.id} className="border rounded-lg px-3 mb-2">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                              <Badge variant="outline" className="text-xs">节点 {idx + 1}</Badge>
                              <span className="font-medium">{(node as any).nodeName}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2 pt-1 pb-3">
                            <div className="space-y-1">
                              <Label className="text-xs">节点名称</Label>
                              <Input
                                className="h-8 text-sm"
                                value={(node as any).nodeName}
                                onChange={(e) => updatePlotNode(node.id, 'nodeName', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">节点内容</Label>
                              <Textarea
                                value={(node as any).nodeContent}
                                onChange={(e) => updatePlotNode(node.id, 'nodeContent', e.target.value)}
                                className="min-h-[80px] resize-none text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">重要程度</Label>
                              <Input
                                className="h-8 text-sm"
                                value={(node as any).importance}
                                onChange={(e) => updatePlotNode(node.id, 'importance', e.target.value)}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePlotNode(node.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              删除此节点
                            </Button>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </section>

              {/* 起承转合 */}
              <section id="section-structure" className="scroll-mt-20">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Layers className="size-5 text-primary" />
                      起承转合结构
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {(Object.entries(skeleton.narrativeStructure) as [string, string][]).map(([key, value]) => {
                      const labels: Record<string, { label: string; desc: string }> = {
                        opening: { label: '起 · 开端', desc: '故事如何开始' },
                        development: { label: '承 · 发展', desc: '情节如何推进' },
                        climax: { label: '转 · 高潮', desc: '最大冲突与转折' },
                        ending: { label: '合 · 结局', desc: '故事如何收尾' },
                      };
                      const info = labels[key] || { label: key, desc: '' };
                      return (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs font-medium">{info.label}</Label>
                          <p className="text-[11px] text-muted-foreground">{info.desc}</p>
                          <Textarea
                            value={value}
                            onChange={(e) =>
                              updateSkeleton((prev) => ({
                                ...prev,
                                narrativeStructure: { ...prev.narrativeStructure, [key]: e.target.value },
                              }))
                            }
                            className="min-h-[100px] resize-none text-sm"
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </section>

              {/* 章节规划 */}
              <section id="section-chapters" className="scroll-mt-20">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BookOpen className="size-5 text-primary" />
                      章节规划
                      <Badge variant="secondary" className="ml-1 text-xs">
                        共 {skeleton.chapterPlan.length} 章
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {skeleton.chapterPlan.map((meta, idx) => (
                        <motion.div
                          key={meta.id}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.03, duration: 0.4 }}
                          className="group rounded-lg border border-border bg-card p-3 transition-all hover:shadow-sm hover:border-primary/30"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px]">
                              第{meta.chapterNumber}章
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              {meta.phase}
                            </Badge>
                          </div>
                          <div className="mb-1.5 text-sm font-medium line-clamp-1">
                            {meta.chapterTitle}
                          </div>
                          <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed">
                            {meta.chapterSummary}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 骨架数据映射 ==========
function mapApiToSkeleton(raw: any): IStorySkeleton {
  const charSettings = Array.isArray(raw.character_settings)
    ? raw.character_settings.map((c: any, i: number) => ({
        id: `char_${Date.now()}_${i}`,
        name: c.name || '未命名角色',
        identity: c.identity || c.role || '',
        personality: c.personality || c.traits || '',
        coreDemand: c.core_demand || c.desire || c.goal || '',
        characterArc: c.character_arc || c.growth || c.arc || '',
      }))
    : [];

  const world = raw.world_setting || raw.worldview || {};
  const worldView = {
    background: world.background || world.era || '',
    rules: world.rules || world.power_system || '',
    coreConflictEnvironment: world.core_conflict_environment || world.conflict || '',
  };

  const plotNodes = Array.isArray(raw.main_plot_nodes || raw.plot_nodes)
    ? (raw.main_plot_nodes || raw.plot_nodes).map((p: any, i: number) => ({
        id: `plot_${Date.now()}_${i}`,
        nodeName: p.node_name || p.name || p.title || `节点 ${i + 1}`,
        nodeContent: p.node_content || p.content || p.description || '',
        importance: p.importance || p.level || '中',
      }))
    : [];

  const struct = raw.narrative_structure || raw.structure || {};
  const narrativeStructure = {
    opening: struct.opening || struct.start || '',
    development: struct.development || struct.middle || '',
    climax: struct.climax || struct.turn || '',
    ending: struct.ending || struct.end || '',
  };

  const chapterPlan = Array.isArray(raw.chapter_plan)
    ? raw.chapter_plan.map((c: any, i: number) => ({
        id: `ch_meta_${Date.now()}_${i}`,
        chapterNumber: String(c.chapter_number || i + 1),
        chapterTitle: c.chapter_title || `第 ${i + 1} 章`,
        chapterSummary: c.chapter_summary || c.summary || '',
        coreEvent: c.core_event || c.key_event || '',
        characters: c.characters || '',
        sceneLocation: c.scene_location || c.location || '',
        moodTone: c.mood_tone || c.tone || '',
        chapterStart: c.chapter_start || c.start || '',
        chapterEnd: c.chapter_end || c.end || '',
        foreshadowing: c.foreshadowing || '',
        phase: (c.phase || '发展') as '铺垫' | '发展' | '高潮' | '收尾',
      }))
    : [];

  return {
    characterSettings: charSettings,
    worldView,
    plotNodes,
    narrativeStructure,
    chapterPlan,
  };
}
