// EXPORTS: GenerationTaskType, IGenerationTask, useGeneration, GenerationProvider
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { capabilityClient, logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { loadCreationState, saveCreationState } from '@/lib/storage';
import type {
  ICategory,
  ICategoryResearchData,
  IOutlineCard,
  IStorySkeleton,
  IChapter,
} from '@/data/novel';

export type GenerationTaskType =
  | 'category_research'
  | 'outline_batch'
  | 'story_skeleton'
  | 'novel_continue'
  | 'novel_polish'
  | 'novel_expand';

export interface IGenerationTask {
  id: string;
  type: GenerationTaskType;
  label: string;
  status: 'running' | 'done' | 'error';
  progressText?: string;
  error?: string;
}

interface GenerationContextValue {
  tasks: IGenerationTask[];
  activeTaskByType: (type: GenerationTaskType) => IGenerationTask | undefined;
  isTaskRunning: (type: GenerationTaskType) => boolean;
  // 品类调研（串行 6 次 text-to-json）
  startCategoryResearch: (directions: string[], mapper: (raw: any) => ICategory) => Promise<ICategoryResearchData | null>;
  // 一句话大纲（流式 text-generate）
  startOutlineBatch: (category: string, count: string, additional: string, parser: (text: string) => IOutlineCard[]) => Promise<IOutlineCard[] | null>;
  getOutlineStreamingText: () => string;
  // 故事骨架（单次 text-to-json）
  startStorySkeleton: (outline: string, mapper: (raw: any) => IStorySkeleton) => Promise<IStorySkeleton | null>;
  // 小说正文流式生成（续写/扩写/润色），返回流式文本的实时读取接口
  startNovelGeneration: (
    taskType: 'novel_continue' | 'novel_polish' | 'novel_expand',
    pluginId: string,
    input: any,
    chapterId: string,
    applyResult: (text: string) => void
  ) => Promise<string | null>;
  getNovelStreamingText: () => string;
  // 取消
  cancelTask: (type: GenerationTaskType) => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

const TASK_LABELS: Record<GenerationTaskType, string> = {
  category_research: '品类调研',
  outline_batch: '一句话大纲',
  story_skeleton: '故事骨架',
  novel_continue: '小说续写',
  novel_polish: '小说润色',
  novel_expand: '小说扩写',
};

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<IGenerationTask[]>([]);
  // 用 ref 持有流式文本实时值，避免 setState 导致 Provider 全量重渲
  const outlineStreamingRef = useRef('');
  const novelStreamingRef = useRef('');
  // 运行中任务类型集合（用 ref 跟踪，避免闭包旧值问题）
  const runningTypesRef = useRef<Set<GenerationTaskType>>(new Set());
  const cancelledTypesRef = useRef<Set<GenerationTaskType>>(new Set());

  const setTaskProgress = useCallback((type: GenerationTaskType, progressText: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.type === type && t.status === 'running' ? { ...t, progressText } : t))
    );
  }, []);

  const markTaskDone = useCallback((type: GenerationTaskType, error?: string) => {
    runningTypesRef.current.delete(type);
    setTasks((prev) =>
      prev.map((t) =>
        t.type === type && t.status === 'running'
          ? { ...t, status: error ? 'error' : 'done', error, progressText: undefined }
          : t
      )
    );
  }, []);

  const startTask = useCallback((type: GenerationTaskType): boolean => {
    // 同类型任务如果已经在跑，不重复启动
    if (runningTypesRef.current.has(type)) {
      return false;
    }
    runningTypesRef.current.add(type);
    cancelledTypesRef.current.delete(type);
    setTasks((prev) => {
      if (prev.some((t) => t.type === type && t.status === 'running')) {
        return prev;
      }
      return [
        ...prev.filter((t) => t.type !== type),
        {
          id: `${type}-${Date.now()}`,
          type,
          label: TASK_LABELS[type],
          status: 'running',
          progressText: '准备中...',
        },
      ];
    });
    return true;
  }, []);

  const activeTaskByType = useCallback(
    (type: GenerationTaskType) => tasks.find((t) => t.type === type && t.status === 'running'),
    [tasks]
  );

  const isTaskRunning = useCallback(
    (type: GenerationTaskType) => tasks.some((t) => t.type === type && t.status === 'running'),
    [tasks]
  );

  const cancelTask = useCallback((type: GenerationTaskType) => {
    cancelledTypesRef.current.add(type);
    runningTypesRef.current.delete(type);
    setTasks((prev) => prev.filter((t) => t.type !== type));
  }, []);

  // ========== 品类调研 ==========
  const startCategoryResearch = useCallback(
    async (directions: string[], mapper: (raw: any) => ICategory): Promise<ICategoryResearchData | null> => {
      const type: GenerationTaskType = 'category_research';
      const ok = startTask(type);
      if (!ok) return null;

      try {
        const categories: ICategory[] = [];
        const state = loadCreationState();
        for (let i = 0; i < directions.length; i++) {
          // 检查是否已被取消
          if (cancelledTypesRef.current.has(type)) {
            return null;
          }
          const cat = directions[i];
          setTaskProgress(type, `正在生成「${cat}」品类数据 (${i + 1}/${directions.length})`);
          try {
            const result = (await capabilityClient
              .load('novel_category_market_research_1')
              .call('textToJson', { category_direction: cat })) as any;

            if (result && result.category_name) {
              const mapped = mapper(result);
              categories.push(mapped);
              // 每完成一个品类就持久化一次
              const researchData: ICategoryResearchData = {
                categories,
                generatedAt: Date.now(),
              };
              saveCreationState({ ...loadCreationState(), categoryResearchData: researchData });
            }
          } catch (err) {
            logger.error(`品类 ${cat} 调研生成失败:`, String(err));
          }
          if (cancelledTypesRef.current.has(type)) {
            return null;
          }
        }

        if (categories.length === 0) {
          markTaskDone(type, '生成失败');
          toast.error('AI 调研生成失败，请重试');
          return null;
        }

        const researchData: ICategoryResearchData = {
          categories,
          generatedAt: Date.now(),
        };
        saveCreationState({ ...loadCreationState(), categoryResearchData: researchData });
        markTaskDone(type);
        toast.success(`已生成 ${categories.length} 个品类的调研数据`);
        return researchData;
      } catch (err) {
        logger.error('品类调研生成失败:', String(err));
        markTaskDone(type, String(err));
        toast.error('AI 调研生成失败，请重试');
        return null;
      }
    },
    [startTask, setTaskProgress, markTaskDone]
  );

  // ========== 一句话大纲 ==========
  const startOutlineBatch = useCallback(
    async (
      category: string,
      count: string,
      additional: string,
      parser: (text: string) => IOutlineCard[]
    ): Promise<IOutlineCard[] | null> => {
      const type: GenerationTaskType = 'outline_batch';
      const ok = startTask(type);
      if (!ok) return null;

      outlineStreamingRef.current = '';
      setTaskProgress(type, `正在为「${category}」生成大纲...`);

      try {
        const stream = capabilityClient
          .load('batch_generate_short_novel_outline_1')
          .callStream('textGenerate', {
            category,
            count,
            additional_requirements: additional,
          });

        let fullText = '';
        for await (const chunk of stream as any) {
          const piece = chunk.content ?? chunk.response ?? '';
          if (piece) {
            fullText += piece;
            outlineStreamingRef.current = fullText;
            // 触发进度更新（轻量）
            setTaskProgress(type, `已生成约 ${fullText.length} 字...`);
            // 每 chunk 都持久化原始文本到 storage（存 outlineList 为空 + rawText 额外字段）
            const state = loadCreationState();
            // 用一个临时字段存流式中的 raw text，通过 outlineList 暂存解析结果
            // 简化：流式过程中不频繁解析，结束后统一解析持久化
            saveCreationState({ ...state });
          }
        }

        const parsed = parser(fullText);
        if (parsed.length === 0) {
          markTaskDone(type, '解析失败');
          toast.error('大纲生成失败，请重试');
          return null;
        }

        const state = loadCreationState();
        saveCreationState({ ...state, outlineList: parsed });
        markTaskDone(type);
        toast.success(`已生成 ${parsed.length} 个故事大纲`);
        return parsed;
      } catch (err) {
        logger.error('一句话大纲生成失败:', String(err));
        markTaskDone(type, String(err));
        toast.error('大纲生成失败，请重试');
        return null;
      }
    },
    [startTask, setTaskProgress, markTaskDone]
  );

  const getOutlineStreamingText = useCallback(() => outlineStreamingRef.current, []);

  // ========== 故事骨架 ==========
  const startStorySkeleton = useCallback(
    async (outline: string, mapper: (raw: any) => IStorySkeleton): Promise<IStorySkeleton | null> => {
      const type: GenerationTaskType = 'story_skeleton';
      const ok = startTask(type);
      if (!ok) return null;

      setTaskProgress(type, '正在生成故事骨架...');

      try {
        const result = (await capabilityClient
          .load('story_outline_generator_1')
          .call('textToJson', { story_outline: outline })) as any;

        if (!result || !result.character_settings) {
          markTaskDone(type, '数据不完整');
          toast.error('骨架生成失败，请重试');
          return null;
        }

        const mapped = mapper(result);
        const state = loadCreationState();
        saveCreationState({ ...state, storySkeleton: mapped });
        markTaskDone(type);
        toast.success('故事骨架生成完成');
        return mapped;
      } catch (err) {
        logger.error('故事骨架生成失败:', String(err));
        markTaskDone(type, String(err));
        toast.error('骨架生成失败，请重试');
        return null;
      }
    },
    [startTask, setTaskProgress, markTaskDone]
  );

  // ========== 小说正文流式生成 ==========
  const startNovelGeneration = useCallback(
    async (
      taskType: 'novel_continue' | 'novel_polish' | 'novel_expand',
      pluginId: string,
      input: any,
      chapterId: string,
      applyResult: (text: string) => void
    ): Promise<string | null> => {
      const ok = startTask(taskType);
      if (!ok) return null;

      novelStreamingRef.current = '';
      const actionLabel =
        taskType === 'novel_polish' ? '润色' : taskType === 'novel_expand' ? '扩写' : '续写';
      setTaskProgress(taskType, `正在${actionLabel}...`);

      try {
        const stream = capabilityClient.load(pluginId).callStream('textGenerate', input);
        let full = '';

        for await (const chunk of stream as any) {
          if (cancelledTypesRef.current.has(taskType)) {
            return null;
          }
          const piece = chunk.content ?? chunk.response ?? '';
          if (piece) {
            full += piece;
            novelStreamingRef.current = full;
            setTaskProgress(taskType, `已生成约 ${full.length} 字...`);
          }
        }

        if (full) {
          // 先更新 storage 中的章节内容（即使页面已卸载，数据也不会丢）
          const state = loadCreationState();
          const updatedChapters: IChapter[] = state.chapters.map((c) =>
            c.id === chapterId
              ? { ...c, status: (c.status === 'unwritten' ? 'generated' : 'edited') as IChapter['status'], lastModified: Date.now() }
              : c
          );
          // 注意：content 由 applyResult 写入 editor 后 autoSave 会同步；
          // 这里确保至少 status 被更新。applyResult 内部会触发 autoSave 写 storage。
          // 如果页面已卸载（applyResult 不生效），我们在这里也把完整内容存好。
          // 先尝试调用 applyResult（在组件上下文中），如果抛错或无效果，下面做兜底
          let applied = false;
          try {
            applyResult(full);
            applied = true;
          } catch {
            applied = false;
          }
          if (!applied) {
            // 兜底：直接在 storage 里追加 content（简单拼接，后续用户打开页面时看到）
            const state2 = loadCreationState();
            const chaptersWithContent: IChapter[] = state2.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              const newContent = (c.content || '') + full.split('\n').filter((p) => p.trim()).map((p) => `<p>${p}</p>`).join('');
              const newStatus: IChapter['status'] = c.status === 'unwritten' ? 'generated' : 'edited';
              return {
                ...c,
                content: newContent,
                status: newStatus,
                lastModified: Date.now(),
              };
            });
            saveCreationState({
              ...state2,
              chapters: chaptersWithContent,
              currentChapterId: state2.currentChapterId || chapterId,
            });
          }
          markTaskDone(taskType);
          const actionLabel2 =
            taskType === 'novel_polish' ? '润色' : taskType === 'novel_expand' ? '扩写' : '续写';
          toast.success(`${actionLabel2}完成`);
          return full;
        }

        markTaskDone(taskType, '生成内容为空');
        return null;
      } catch (err) {
        logger.error('AI 生成失败:', String(err));
        markTaskDone(taskType, String(err));
        toast.error('AI 生成失败，请重试');
        return null;
      }
    },
    [startTask, setTaskProgress, markTaskDone]
  );

  const getNovelStreamingText = useCallback(() => novelStreamingRef.current, []);

  // 自动清理已完成任务（30s 后移除）
  useEffect(() => {
    const doneTasks = tasks.filter((t) => t.status === 'done' || t.status === 'error');
    if (doneTasks.length === 0) return;
    const timer = window.setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.status === 'running'));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [tasks]);

  const value = useMemo<GenerationContextValue>(
    () => ({
      tasks,
      activeTaskByType,
      isTaskRunning,
      startCategoryResearch,
      startOutlineBatch,
      getOutlineStreamingText,
      startStorySkeleton,
      startNovelGeneration,
      getNovelStreamingText,
      cancelTask,
    }),
    [
      tasks,
      activeTaskByType,
      isTaskRunning,
      startCategoryResearch,
      startOutlineBatch,
      getOutlineStreamingText,
      startStorySkeleton,
      startNovelGeneration,
      getNovelStreamingText,
      cancelTask,
    ]
  );

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGeneration() {
  const ctx = useContext(GenerationContext);
  if (!ctx) {
    throw new Error('useGeneration must be used within GenerationProvider');
  }
  return ctx;
}
