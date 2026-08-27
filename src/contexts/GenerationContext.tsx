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
import { loadCreationState, saveCreationState, updateCurrentArticle, setArticleSkeletonForArticle, updateArticleById } from '@/lib/storage';
import { ensureSafeCurrentContext } from '@/lib/chapter-context';
import type { ICategory, ICategoryResearchData, IOutlineCard, IStorySkeleton, IChapter, ICreationState, NovelLengthType } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';

export type GenerationTaskType =
  | 'category_research'
  | 'outline_batch'
  | 'story_skeleton'
  | 'novel_continue'
  | 'novel_polish'
  | 'novel_expand'
  | 'novel_chapter_generate'
  | 'novel_book_generate';

export type GenerationPauseStatus = 'idle' | 'paused' | 'stopped';

export interface IGenerationTask {
  id: string;
  type: GenerationTaskType;
  label: string;
  status: 'running' | 'done' | 'error';
  progressText?: string;
  pauseStatus?: GenerationPauseStatus;
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
  startStorySkeleton: (
    outline: string,
    lengthType: NovelLengthType,
    mapper: (raw: any) => IStorySkeleton,
    articleId?: string
  ) => Promise<IStorySkeleton | null>;
  // 小说正文流式生成（续写/扩写/润色），返回流式文本的实时读取接口
  startNovelGeneration: (
    taskType: 'novel_continue' | 'novel_polish' | 'novel_expand',
    pluginId: string,
    input: any,
    chapterId: string,
    applyResult: (text: string) => void,
    articleId?: string
  ) => Promise<string | null>;
  getNovelStreamingText: () => string;
  // 取消
  cancelTask: (type: GenerationTaskType) => void;
  // 整章生成（流式）
  startChapterGeneration: (params: {
    chapterId: string;
    pluginId: string;
    input: any;
    articleId?: string;
  }) => Promise<string | null>;
  getChapterStreamingText: () => string;
  isChapterGenerating: (chapterId: string) => boolean;
  getGeneratingChapterId: () => string | null;
  // 暂停 / 继续 / 停止
  pauseTask: (type: GenerationTaskType) => void;
  resumeTask: (type: GenerationTaskType) => void;
  stopTask: (type: GenerationTaskType) => void;
  getTaskPauseStatus: (type: GenerationTaskType) => GenerationPauseStatus;
  isTaskStopped: (type: GenerationTaskType) => boolean;
  // 整本书生成
  startBookGeneration: (params: {
    startChapterId: string;
    pluginId: string;
    buildInput: (chapterId: string) => any;
    articleId?: string;
  }) => Promise<boolean>;
  getBookProgress: () => { currentIndex: number; total: number; currentChapterId: string | null; chapterTitle: string | null; paused: boolean; stopped: boolean; done: boolean } | null;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

const TASK_LABELS: Record<GenerationTaskType, string> = {
  category_research: '品类调研',
  outline_batch: '一句话大纲',
  story_skeleton: '故事骨架',
  novel_continue: '小说续写',
  novel_polish: '小说润色',
  novel_expand: '小说扩写',
  novel_chapter_generate: '整章生成',
  novel_book_generate: '整本书生成',
};

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<IGenerationTask[]>([]);
  // 用 ref 持有流式文本实时值，避免 setState 导致 Provider 全量重渲
  const outlineStreamingRef = useRef('');
  const novelStreamingRef = useRef('');
  const chapterStreamingRef = useRef('');
  const generatingChapterIdRef = useRef<string | null>(null);
  // 运行中任务类型集合（用 ref 跟踪，避免闭包旧值问题）
  const runningTypesRef = useRef<Set<GenerationTaskType>>(new Set());
  const cancelledTypesRef = useRef<Set<GenerationTaskType>>(new Set());
  // 暂停 / 停止状态
  const pausedTypesRef = useRef<Set<GenerationTaskType>>(new Set());
  const stoppedTypesRef = useRef<Set<GenerationTaskType>>(new Set());
  // 暂停时阻塞的 Promise resolve 函数（用于 continue 时恢复）
  const pauseResolversRef = useRef<Map<GenerationTaskType, () => void>>(new Map());
  // 整本书生成进度
  const bookProgressRef = useRef<{
    currentIndex: number;
    total: number;
    currentChapterId: string | null;
    chapterTitle: string | null;
    paused: boolean;
    stopped: boolean;
    done: boolean;
  } | null>(null);

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

  // ========== 故事骨架生成（含详细章节规划） ==========
  const startStorySkeleton = useCallback(
    async (
      outline: string,
      lengthType: NovelLengthType,
      mapper: (raw: any) => IStorySkeleton,
      articleId?: string
    ): Promise<IStorySkeleton | null> => {
      const type: GenerationTaskType = 'story_skeleton';
      const ok = startTask(type);
      if (!ok) return null;

      setTaskProgress(type, '正在生成故事骨架...');

      try {
        const lengthInfo = NOVEL_LENGTH_OPTIONS[lengthType];
        const prompt = `请基于以下一句话故事大纲，生成一份完整的小说故事骨架。

【一句话大纲】
${outline}

【篇幅要求】
篇幅类型：${lengthInfo.label}（${lengthInfo.wordRange}，${lengthInfo.chapterRange}）
请生成约 ${lengthInfo.suggestedChapters} 个章节的详细规划。

【章节规划详细要求】
每个章节必须包含以下字段，内容要充实具体，不能只有一两句话：
- chapter_number：章节序号
- chapter_title：章节标题
- chapter_summary：本章概要（完整段落，描述本章主要剧情走向）
- core_event：核心事件（2-3句话，明确本章最关键的情节）
- characters：出场人物（列出本章主要角色，以及他们在本章中的目的、行动和冲突）
- scene_location：场景地点（本章主要发生的场景和环境）
- mood_tone：情绪基调（本章整体氛围，如紧张、温馨、悬疑、高潮、悲伤、轻松等）
- chapter_start：本章起点（承接上一章的什么内容，本章开头从哪里切入）
- chapter_end：本章终点（本章结尾停在什么节点，留下什么悬念或如何过渡到下一章）
- foreshadowing：关键伏笔或悬念（本章埋下什么伏笔，或回收什么伏笔）
- phase：所属阶段（从"铺垫、发展、高潮、收尾"中选择一个，体现整体起承转合节奏）

请严格按照上述字段输出，确保章节之间有清晰的起承转合节奏，前因后果连贯。`;

        const result = (await capabilityClient
          .load('story_outline_generator_1')
          .call('textToJson', { story_outline: prompt })) as any;

        if (!result || !result.character_settings) {
          markTaskDone(type, '数据不完整');
          toast.error('骨架生成失败，请重试');
          return null;
        }

        const mapped = mapper(result);
        const state = loadCreationState();
        // 写入到指定文章（articleId 优先），无则 fallback 到全局 currentArticleId
        const targetArticleId = articleId || state.currentArticleId;
        let newState: ICreationState = { ...state, storySkeleton: mapped };
        if (targetArticleId) {
          newState = setArticleSkeletonForArticle(newState, targetArticleId, mapped);
        }
        saveCreationState(newState);
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
      applyResult: (text: string) => void,
      articleId?: string
    ): Promise<string | null> => {
      const ok = startTask(taskType);
      if (!ok) return null;

      novelStreamingRef.current = '';
      const actionLabel =
        taskType === 'novel_polish' ? '润色' : taskType === 'novel_expand' ? '扩写' : '续写';
      setTaskProgress(taskType, `正在${actionLabel}...`);

      try {
        // current_context 必填兜底（续写/扩写场景 chapterContent 可能为空）
        const safeInput = ensureSafeCurrentContext(input);
        const stream = capabilityClient.load(pluginId).callStream('textGenerate', safeInput);
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
          const state = loadCreationState();
          const targetArticleId = articleId || state.currentArticleId;

          // 1) 写入指定文章的章节内容
          let stateWithArticle = state;
          if (targetArticleId) {
            stateWithArticle = updateArticleById(state, targetArticleId, (a) => {
              const updatedChapters = a.chapters.map((c) =>
                c.id === chapterId
                  ? {
                      ...c,
                      status: (c.status === 'unwritten' ? 'generated' : 'edited') as IChapter['status'],
                      lastModified: Date.now(),
                    }
                  : c
              );
              return {
                ...a,
                chapters: updatedChapters,
                currentChapterId: a.currentChapterId || chapterId,
              };
            });
            saveCreationState(stateWithArticle);
          }

          // 同步顶层 chapters（向后兼容）
          const topChapters = stateWithArticle.chapters.length > 0 ? stateWithArticle.chapters : state.chapters;
          const updatedTopChapters: IChapter[] = topChapters.map((c) =>
            c.id === chapterId
              ? { ...c, status: (c.status === 'unwritten' ? 'generated' : 'edited') as IChapter['status'], lastModified: Date.now() }
              : c
          );
          stateWithArticle = { ...stateWithArticle, chapters: updatedTopChapters };
          saveCreationState(stateWithArticle);

          // 2) 调用 applyResult（页面存活时更新编辑器）
          let applied = false;
          try {
            applyResult(full);
            applied = true;
          } catch {
            applied = false;
          }
          if (!applied) {
            // 兜底：页面已卸载，直接在 storage 里追加 content
            const state2 = loadCreationState();
            const targetId = articleId || state2.currentArticleId;
            if (targetId) {
              const state2WithArticle = updateArticleById(state2, targetId, (a) => {
                const chaptersWithContent = a.chapters.map((c) => {
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
                return {
                  ...a,
                  chapters: chaptersWithContent,
                  currentChapterId: a.currentChapterId || chapterId,
                };
              });
              saveCreationState(state2WithArticle);
            } else {
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

  // ========== 整章生成 ==========
  const startChapterGeneration = useCallback(
    async (params: {
      chapterId: string;
      pluginId: string;
      input: any;
      articleId?: string;
    }): Promise<string | null> => {
      const { chapterId, pluginId, input, articleId } = params;
      const type: GenerationTaskType = 'novel_chapter_generate';
      const ok = startTask(type);
      if (!ok) return null;

      chapterStreamingRef.current = '';
      generatingChapterIdRef.current = chapterId;
      setTaskProgress(type, '准备生成章节...');

      try {
        // current_context 必填兜底
        const state0 = loadCreationState();
        const targetArticleId0 = articleId || state0.currentArticleId;
        let chapterInfo: { chapterNumber?: number | string; chapterTitle?: string; content?: string } | undefined;
        const allChapters = targetArticleId0
          ? state0.articles.find((a) => a.id === targetArticleId0)?.chapters || state0.chapters
          : state0.chapters;
        const ch = allChapters.find((c) => c.id === chapterId);
        if (ch) chapterInfo = { chapterNumber: ch.chapterNumber, chapterTitle: ch.chapterTitle, content: ch.content };
        const safeInput = ensureSafeCurrentContext(input, chapterInfo);

        const stream = capabilityClient.load(pluginId).callStream('textGenerate', safeInput);
        let full = '';

        for await (const chunk of stream as any) {
          if (cancelledTypesRef.current.has(type) || stoppedTypesRef.current.has(type)) {
            return null;
          }
          const piece = chunk.content ?? chunk.response ?? '';
          if (piece) {
            full += piece;
            chapterStreamingRef.current = full;
            setTaskProgress(type, `已生成约 ${full.length} 字...`);
            // 每 chunk 实时写入 storage，按 articleId 精确写入目标文章
            const state = loadCreationState();
            const targetArticleId = articleId || state.currentArticleId;
            let baseChapters: IChapter[] = state.chapters;
            if (targetArticleId) {
              const art = state.articles.find((a) => a.id === targetArticleId);
              if (art) baseChapters = art.chapters;
            }
            const updatedChapters: IChapter[] = baseChapters.map((c) => {
              if (c.id !== chapterId) return c;
              const htmlContent = full
                .split('\n')
                .filter((p) => p.trim())
                .map((p) => `<p>${p}</p>`)
                .join('');
              return {
                ...c,
                content: htmlContent,
                status: 'generated' as const,
                lastModified: Date.now(),
              };
            });
            let newState: ICreationState = { ...state, chapters: updatedChapters };
            // 写入目标文章
            if (targetArticleId) {
              newState = updateArticleById(newState, targetArticleId, (a) => ({
                ...a,
                chapters: updatedChapters,
                currentChapterId: a.currentChapterId || chapterId,
              }));
            } else {
              newState.currentChapterId = state.currentChapterId || chapterId;
            }
            saveCreationState(newState);
          }

          // 暂停检查
          if (pausedTypesRef.current.has(type)) {
            setTaskProgress(type, '已暂停');
            await new Promise<void>((resolve) => {
              pauseResolversRef.current.set(type, resolve);
            });
            if (stoppedTypesRef.current.has(type)) {
              return null;
            }
            setTaskProgress(type, `已生成约 ${full.length} 字...`);
          }
        }

        if (full) {
          markTaskDone(type);
          toast.success('章节生成完成');
          return full;
        }

        markTaskDone(type, '生成内容为空');
        return null;
      } catch (err) {
        const errMsg = extractErrorMessage(err);
        logger.error('章节生成失败:', errMsg);
        markTaskDone(type, errMsg);
        toast.error(`章节生成失败：${errMsg}`);
        return null;
      } finally {
        // 延迟清理 generatingChapterId，让 UI 有时间展示完成态
        window.setTimeout(() => {
          if (generatingChapterIdRef.current === chapterId) {
            generatingChapterIdRef.current = null;
          }
        }, 1000);
      }
    },
    [startTask, setTaskProgress, markTaskDone]
  );

  const getChapterStreamingText = useCallback(() => chapterStreamingRef.current, []);

  const isChapterGenerating = useCallback(
    (chapterId: string) =>
      runningTypesRef.current.has('novel_chapter_generate') &&
      generatingChapterIdRef.current === chapterId,
    []
  );

  const getGeneratingChapterId = useCallback(() => generatingChapterIdRef.current, []);

  // ========== 暂停 / 继续 / 停止 ==========

  const setTaskPauseStatus = useCallback((type: GenerationTaskType, pauseStatus: GenerationPauseStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.type === type && t.status === 'running' ? { ...t, pauseStatus } : t))
    );
  }, []);

  const pauseTask = useCallback(
    (type: GenerationTaskType) => {
      if (!runningTypesRef.current.has(type)) return;
      pausedTypesRef.current.add(type);
      setTaskPauseStatus(type, 'paused');
    },
    [setTaskPauseStatus]
  );

  const resumeTask = useCallback(
    (type: GenerationTaskType) => {
      if (!pausedTypesRef.current.has(type)) return;
      pausedTypesRef.current.delete(type);
      setTaskPauseStatus(type, 'idle');
      // 触发暂停 resolve 让循环继续
      const resolver = pauseResolversRef.current.get(type);
      if (resolver) {
        pauseResolversRef.current.delete(type);
        resolver();
      }
    },
    [setTaskPauseStatus]
  );

  const stopTask = useCallback(
    (type: GenerationTaskType) => {
      stoppedTypesRef.current.add(type);
      // 同时解除暂停
      pausedTypesRef.current.delete(type);
      const resolver = pauseResolversRef.current.get(type);
      if (resolver) {
        pauseResolversRef.current.delete(type);
        resolver();
      }
      setTaskPauseStatus(type, 'stopped');
    },
    [setTaskPauseStatus]
  );

  const getTaskPauseStatus = useCallback(
    (type: GenerationTaskType): GenerationPauseStatus => {
      if (stoppedTypesRef.current.has(type)) return 'stopped';
      if (pausedTypesRef.current.has(type)) return 'paused';
      return 'idle';
    },
    []
  );

  const isTaskStopped = useCallback(
    (type: GenerationTaskType) => stoppedTypesRef.current.has(type),
    []
  );

  /** 在流式循环中检查暂停/停止 — 暂停时阻塞等待，停止时返回 true 表示应中断 */
  async function checkPauseStop(type: GenerationTaskType): Promise<boolean> {
    if (stoppedTypesRef.current.has(type)) return true;
    if (pausedTypesRef.current.has(type)) {
      setTaskProgress(type, '已暂停');
      await new Promise<void>((resolve) => {
        pauseResolversRef.current.set(type, resolve);
      });
      // 恢复后再检查一次停止
      if (stoppedTypesRef.current.has(type)) return true;
    }
    return false;
  }

  // ========== 整本书生成（逐章串行，支持暂停/继续/停止） ==========

  const startBookGeneration = useCallback(
    async (params: {
      startChapterId: string;
      pluginId: string;
      buildInput: (chapterId: string) => any;
      articleId?: string;
    }): Promise<boolean> => {
      const { startChapterId, pluginId, buildInput, articleId } = params;
      const type: GenerationTaskType = 'novel_book_generate';
      const ok = startTask(type);
      if (!ok) return false;

      // 清理停止状态（重新开始时重置）
      stoppedTypesRef.current.delete(type);
      pausedTypesRef.current.delete(type);
      setTaskPauseStatus(type, 'idle');

      try {
        const state = loadCreationState();
        const targetArticleId = articleId || state.currentArticleId;
        const targetArticle = targetArticleId
          ? state.articles.find((a) => a.id === targetArticleId) || null
          : null;
        const chapters = targetArticle?.chapters || state.chapters || [];
        const startIndex = chapters.findIndex((c) => c.id === startChapterId);
        if (startIndex === -1) {
          markTaskDone(type, '起始章节不存在');
          toast.error('起始章节不存在');
          return false;
        }

        const total = chapters.length - startIndex;
        bookProgressRef.current = {
          currentIndex: 0,
          total,
          currentChapterId: startChapterId,
          chapterTitle: chapters[startIndex]?.chapterTitle || null,
          paused: false,
          stopped: false,
          done: false,
        };

        for (let i = startIndex; i < chapters.length; i++) {
          // 每章开始前检查暂停/停止
          if (await checkPauseStop(type)) {
            break;
          }

          const chapter = chapters[i];
          bookProgressRef.current = {
            ...bookProgressRef.current!,
            currentIndex: i - startIndex,
            currentChapterId: chapter.id,
            chapterTitle: chapter.chapterTitle,
          };
          setTaskProgress(type, `第 ${i - startIndex + 1}/${total} 章生成中：${chapter.chapterTitle}`);

          // 如果本章已生成（有内容），跳过（继续生成的情况不重写已有内容，仅生成未生成章节）
          if (chapter.content && chapter.content.trim().length > 0) {
            // 已生成章节直接跳过
            continue;
          }

          // 启动单章生成 —— 这里内联实现以支持每 chunk 检查暂停
          chapterStreamingRef.current = chapter.content || '';
          generatingChapterIdRef.current = chapter.id;

          const input = buildInput(chapter.id);
          // ===== 逐章构建高质量 current_context（整本书生成模式下每章都重新计算） =====
          // 1. 从 storage 读取最新已生成章节作为前文（避免页面闭包 stale 数据）
          const latestState = loadCreationState();
          const tgtId = articleId || latestState.currentArticleId;
          const latestChapters = tgtId
            ? (latestState.articles.find((a) => a.id === tgtId)?.chapters || latestState.chapters)
            : latestState.chapters;
          const curIdx = latestChapters.findIndex((c) => c.id === chapter.id);
          const prevChapters = curIdx > 0 ? latestChapters.slice(0, curIdx) : [];

          let prevContext = '';
          if (prevChapters.length > 0) {
            // 收集最近 3 章的正文片段作为前文上下文
            const prevTexts: string[] = [];
            for (let k = prevChapters.length - 1; k >= 0 && prevTexts.length < 3; k--) {
              const pch = prevChapters[k];
              const plain = (pch.content || '').replace(/<[^>]+>/g, '').trim();
              if (plain) {
                const snippet = plain.slice(0, 600);
                prevTexts.unshift(
                  `【第${pch.chapterNumber}章 ${pch.chapterTitle}】\n${snippet}${plain.length > 600 ? '\n...（内容有删减）' : ''}`
                );
              } else if (pch.chapterSummary) {
                prevTexts.unshift(
                  `【第${pch.chapterNumber}章 ${pch.chapterTitle}】${pch.chapterSummary}`
                );
              }
            }
            prevContext = prevTexts.join('\n\n');
          }

          // 2. 如果 buildInput 传了 current_context 就用它，否则用上面拼的
          const inputCtx = (input.current_context && input.current_context.trim()) || '';
          const finalContext = inputCtx || prevContext;

          // 3. 合并：buildInput 里的 novel_outline / generation_requirement 保留，current_context 用我们拼的
          const mergedInput = { ...input, current_context: finalContext };

          // 4. 最后兜底保险（确保永远不为空）
          const safeInput = ensureSafeCurrentContext(mergedInput, {
            chapterNumber: chapter.chapterNumber,
            chapterTitle: chapter.chapterTitle,
            content: chapter.content,
          });
          // 已有内容的话从末尾续写（这里整本书模式下都是新章节，直接生成）
          const stream = capabilityClient.load(pluginId).callStream('textGenerate', safeInput);
          let full = chapter.content ? chapter.content.replace(/<\/?p>/g, '').split('\n').join('\n') : '';

          try {
            for await (const chunk of stream as any) {
              if (stoppedTypesRef.current.has(type)) {
                break;
              }
              const piece = chunk.content ?? chunk.response ?? '';
              if (piece) {
                full += piece;
                chapterStreamingRef.current = full;
                setTaskProgress(type, `第 ${i - startIndex + 1}/${total} 章生成中：${chapter.chapterTitle}`);
                // 每 chunk 实时写入目标文章
                 const st = loadCreationState();
                 const tgtId = articleId || st.currentArticleId;
                 let articleChapters: IChapter[] = st.chapters;
                 if (tgtId) {
                   const art = st.articles.find((a) => a.id === tgtId);
                   if (art) articleChapters = art.chapters;
                 }
                 const withContent = articleChapters.map((c) => {
                   if (c.id !== chapter.id) return c;
                   const htmlContent = full
                     .split('\n')
                     .filter((p) => p.trim())
                     .map((p) => `<p>${p}</p>`)
                     .join('');
                   return {
                     ...c,
                     content: htmlContent,
                     status: 'generated' as const,
                     lastModified: Date.now(),
                   };
                 });
                 let newState: ICreationState = { ...st, chapters: withContent };
                 if (tgtId) {
                   newState = updateArticleById(newState, tgtId, (a) => ({
                     ...a,
                     chapters: withContent,
                   }));
                 }
                 saveCreationState(newState);
              }

              // 每 chunk 后检查暂停
              if (pausedTypesRef.current.has(type)) {
                if (await checkPauseStop(type)) {
                  break;
                }
                setTaskProgress(type, `第 ${i - startIndex + 1}/${total} 章生成中：${chapter.chapterTitle}`);
              }
            }
          } catch (err) {
            const errMsg = extractErrorMessage(err);
            logger.error(`整本书生成 第${i + 1}章失败:`, errMsg);
            toast.error(`${chapter.chapterTitle} 生成失败：${errMsg}`);
          }

          // 本章结束后检查是否被停止
          if (stoppedTypesRef.current.has(type)) {
            break;
          }
        }

        const wasStopped = stoppedTypesRef.current.has(type);
        bookProgressRef.current = {
          ...bookProgressRef.current!,
          paused: pausedTypesRef.current.has(type),
          stopped: wasStopped,
          done: !wasStopped,
        };

        if (wasStopped) {
          markTaskDone(type, '已停止');
          toast.info('已停止生成，已生成内容已保存');
          return false;
        }

        markTaskDone(type);
        toast.success('全书生成完成');
        return true;
      } catch (err) {
        const errMsg = extractErrorMessage(err);
        logger.error('整本书生成失败:', errMsg);
        markTaskDone(type, errMsg);
        toast.error(`整本书生成失败：${errMsg}`);
        return false;
      } finally {
        window.setTimeout(() => {
          generatingChapterIdRef.current = null;
        }, 1000);
      }
    },
    [startTask, setTaskProgress, markTaskDone, setTaskPauseStatus]
  );

  const getBookProgress = useCallback(
    () => bookProgressRef.current,
    []
  );

  // 从 Error 对象中提取可读的错误信息
  function extractErrorMessage(err: unknown): string {
    if (!err) return '未知错误';
    if (err instanceof Error) {
      // 优先看 message
      let msg = err.message || String(err);
      // 尝试解析 message 中的 JSON 错误
      try {
        const parsed = JSON.parse(msg);
        if (parsed.message) msg = parsed.message;
        else if (parsed.error) msg = parsed.error;
        else if (parsed.msg) msg = parsed.msg;
      } catch {
        // 不是 JSON，用原 message
      }
      // 截断过长的错误信息
      if (msg.length > 150) msg = msg.slice(0, 150) + '...';
      return msg;
    }
    if (typeof err === 'string') return err.slice(0, 150);
    try {
      return JSON.stringify(err).slice(0, 150);
    } catch {
      return '未知错误';
    }
  }

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
      startChapterGeneration,
      getChapterStreamingText,
      isChapterGenerating,
      getGeneratingChapterId,
      pauseTask,
      resumeTask,
      stopTask,
      getTaskPauseStatus,
      isTaskStopped,
      startBookGeneration,
      getBookProgress,
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
      startChapterGeneration,
      getChapterStreamingText,
      isChapterGenerating,
      getGeneratingChapterId,
      pauseTask,
      resumeTask,
      stopTask,
      getTaskPauseStatus,
      isTaskStopped,
      startBookGeneration,
      getBookProgress,
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
