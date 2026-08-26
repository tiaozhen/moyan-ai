import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  GitBranch,
  Loader2,
  Users,
  Globe,
  Waypoints,
  Layers,
  BookOpen,
  Check,
  Edit3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { IOutlineCard, IStorySkeleton, IChapter } from '@/data/novel';
import { loadCreationState, saveCreationState } from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';

const SECTIONS = [
  { id: 'characters', label: '人物设定', icon: Users },
  { id: 'worldview', label: '世界观', icon: Globe },
  { id: 'plot', label: '剧情节点', icon: Waypoints },
  { id: 'structure', label: '起承转合', icon: Layers },
  { id: 'chapters', label: '章节规划', icon: BookOpen },
];

export default function OutlineExpansionPage() {
  const navigate = useNavigate();
  const [outline, setOutline] = useState<IOutlineCard | null>(null);
  const [skeleton, setSkeleton] = useState<IStorySkeleton | null>(null);
  const [activeSection, setActiveSection] = useState('characters');
  const [editingField, setEditingField] = useState<string | null>(null);
  const { startStorySkeleton, isTaskRunning, tasks } = useGeneration();
  const loading = isTaskRunning('story_skeleton');

  useEffect(() => {
    const state = loadCreationState();
    if (state.selectedOutline) {
      setOutline(state.selectedOutline);
    }
    if (state.storySkeleton) {
      setSkeleton(state.storySkeleton);
    }
  }, []);

  // 生成完成后读最终数据（切页面回来也能拿到）
  useEffect(() => {
    const doneTask = tasks.find((t) => t.type === 'story_skeleton' && t.status === 'done');
    if (doneTask) {
      const state = loadCreationState();
      if (state.storySkeleton) {
        setSkeleton(state.storySkeleton);
      }
    }
  }, [tasks]);

  const generateSkeleton = useCallback(async () => {
    if (!outline) {
      toast.warning('请先选择一个故事大纲');
      navigate('/outline');
      return;
    }

    const result = await startStorySkeleton(outline.concept, mapApiToSkeleton);
    if (result) {
      setSkeleton(result);
    }
  }, [outline, navigate, startStorySkeleton]);

  const handleConfirm = useCallback(() => {
    if (!skeleton) return;
    const state = loadCreationState();

    // 只有章节列表为空时才从骨架初始化，避免覆盖已有的正文内容
    let chapters: IChapter[];
    if (state.chapters && state.chapters.length > 0) {
      chapters = state.chapters;
    } else {
      chapters = skeleton.chapterPlan.map((meta) => ({
        ...meta,
        id: meta.id,
        content: '',
        status: 'unwritten' as const,
        lastModified: Date.now(),
      }));
    }

    const newState = {
      ...state,
      storySkeleton: skeleton,
      chapters,
      currentChapterId: state.currentChapterId || chapters[0]?.id || null,
    };
    saveCreationState(newState);
    toast.success('骨架已确认，开始创作吧！');
    navigate('/novel');
  }, [skeleton, navigate]);

  const updateSkeleton = useCallback((updater: (prev: IStorySkeleton) => IStorySkeleton) => {
    setSkeleton((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      // 防抖持久化：编辑完成后写入 storage
      const state = loadCreationState();
      saveCreationState({ ...state, storySkeleton: next });
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
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* 顶部 */}
      <section className="mb-8 md:mb-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/outline')}
          className="mb-4 gap-1"
        >
          <ArrowLeft className="size-4" />
          返回一句话大纲
        </Button>

        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <GitBranch className="size-3" />
                第三步
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">故事骨架拓展</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              AI 将一句话大纲拓展为完整的故事架构，涵盖人物、世界观、剧情节点和章节规划，
              你可以直接编辑微调
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={generateSkeleton}
              disabled={loading || !outline}
              size="lg"
              className="gap-2"
            >
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
            {skeleton && (
              <Button onClick={handleConfirm} size="lg" variant="secondary" className="gap-2">
                <Check className="size-4" />
                确认骨架，开始创作
              </Button>
            )}
          </div>
        </div>

        {outline && (
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <GitBranch className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">当前大纲：{outline.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{outline.concept}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 未选大纲提示 */}
      {!outline && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <GitBranch className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">还没有选定大纲</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            请先回到一句话大纲页面，选择一个你感兴趣的故事点子
          </p>
          <Button className="mt-4" onClick={() => navigate('/outline')}>
            去选择大纲
          </Button>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="rounded-xl border border-border bg-card/30 p-16 text-center">
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            AI 正在构建故事骨架，包括人物设定、世界观、剧情节点等，请稍候...
          </p>
        </div>
      )}

      {/* 空状态 */}
      {outline && !skeleton && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Layers className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">构建你的故事世界</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            点击「AI 生成骨架」，系统将基于选定的一句话大纲，
            自动生成完整的故事架构
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
                subtitle="全书的章节划分与概要"
                onEdit={() => setEditingField('chapters')}
                isEditing={editingField === 'chapters'}
              />
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {skeleton.chapterPlan.map((ch, idx) => (
                      <div key={ch.id} className="flex gap-4 p-4">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {ch.chapterNumber || idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <EditableField
                              label="章节标题"
                              value={ch.chapterTitle}
                              fieldKey={`ch-title-${ch.id}`}
                              editingField={editingField}
                              isTitle
                              onSave={(v) =>
                                updateSkeleton((prev) => ({
                                  ...prev,
                                  chapterPlan: prev.chapterPlan.map((c) =>
                                    c.id === ch.id ? { ...c, chapterTitle: v } : c
                                  ),
                                }))
                              }
                            />
                          </div>
                          <EditableField
                            label="章节概要"
                            value={ch.chapterSummary}
                            fieldKey={`ch-summary-${ch.id}`}
                            editingField={editingField}
                            onSave={(v) =>
                              updateSkeleton((prev) => ({
                                ...prev,
                                chapterPlan: prev.chapterPlan.map((c) =>
                                  c.id === ch.id ? { ...c, chapterSummary: v } : c
                                ),
                              }))
                            }
                          />
                          {ch.coreEvent && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium">核心事件：</span>
                              {ch.coreEvent}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
    })) || [];

  return {
    characterSettings: characters,
    worldView,
    plotNodes,
    narrativeStructure,
    chapterPlan,
  };
}
