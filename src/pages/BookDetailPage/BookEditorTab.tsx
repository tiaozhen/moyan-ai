import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  Save,
  Loader2,
  Sparkles,
  FileText,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelRight,
  Maximize2,
  Minimize2,
  Plus,
  Check,
  Edit3,
  Lock,
  List,
  Wand2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List as ListIcon,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Pause,
  Play,
  Square,
  ChevronDown,
  Info,
  AlertCircle,
  ArrowLeft,
  BookMarked,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import type { IChapter, IStorySkeleton, INovelArticle } from '@/data/novel';
import {
  loadCreationState,
  saveCreationState,
  updateArticleById,
  setArticleChapterId,
} from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';
import { buildChapterGenerationInput } from '@/lib/chapter-context';
import EditorToolbar from '@/pages/NovelGeneratorPage/EditorToolbar';

// ========== 存储键 ==========
const STORAGE_KEY = 'editor_layout';

function loadLayoutState() {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* noop */
  }
  return { leftOpen: true, rightOpen: true, focusMode: false };
}

function saveLayoutState(state: { leftOpen: boolean; rightOpen: boolean; focusMode: boolean }) {
  try {
    scopedStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

// ========== 字数统计 ==========
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  return text.length;
}

// ========== 主组件 ==========
export default function BookEditorTab() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<IChapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<IStorySkeleton | null>(null);
  const [article, setArticle] = useState<INovelArticle | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | undefined>();
  const [saving, setSaving] = useState(false);
  const [isAnyGeneratingState, setIsAnyGeneratingState] = useState(false);

  // 布局状态
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const [chapterInfoOpen, setChapterInfoOpen] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const {
    isTaskRunning,
    startChapterGeneration,
    startNovelGeneration,
    getGeneratingChapterId,
    getChapterStreamingText,
    getNovelStreamingText,
    getBookProgress,
    pauseTask,
    resumeTask,
    stopTask,
    getTaskPauseStatus,
    startBookGeneration,
  } = useGeneration();

  const isGenerating =
    isTaskRunning('novel_continue') ||
    isTaskRunning('novel_polish') ||
    isTaskRunning('novel_expand');
  const isChapterGenerating = isTaskRunning('novel_chapter_generate');
  const isBookGenerating = isTaskRunning('novel_book_generate');
  const bookProgress = getBookProgress();
  const bookPauseStatus = getTaskPauseStatus('novel_book_generate');
  const isBookPaused = bookPauseStatus === 'paused';
  const isBookStopped = bookPauseStatus === 'stopped';

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  // ========== 初始化布局状态 ==========
  useEffect(() => {
    const saved = loadLayoutState();
    setLeftOpen(saved.leftOpen);
    setRightOpen(saved.rightOpen);
    setFocusMode(saved.focusMode);
  }, []);

  // 持久化布局
  useEffect(() => {
    saveLayoutState({ leftOpen, rightOpen, focusMode });
  }, [leftOpen, rightOpen, focusMode]);

  // 专注模式 = 两边都关
  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      if (next) {
        setLeftOpen(false);
        setRightOpen(false);
      } else {
        setLeftOpen(true);
        setRightOpen(true);
      }
      return next;
    });
  }, []);

  // ========== 加载当前书籍数据 ==========
  useEffect(() => {
    if (!bookId) return;
    const state = loadCreationState();
    const art = state.articles.find((a) => a.id === bookId) || null;
    if (!art) {
      setChapters([]);
      setCurrentChapterId(null);
      setSkeleton(null);
      setArticle(null);
      return;
    }
    setArticle(art);
    let initChapters: IChapter[] = art.chapters || [];
    if (initChapters.length === 0 && art.storySkeleton && Array.isArray(art.storySkeleton.chapterPlan)) {
      initChapters = art.storySkeleton.chapterPlan
        .filter((meta) => meta && meta.id)
        .map((meta) => ({
          ...meta,
          id: meta.id,
          content: '',
          status: 'unwritten' as const,
          lastModified: Date.now(),
        }));
      if (initChapters.length > 0) {
        const newState = updateArticleById(state, bookId, (a) => ({
          ...a,
          chapters: initChapters,
          currentChapterId: initChapters[0]?.id || null,
        }));
        saveCreationState(newState);
      }
    }
    setChapters(initChapters);
    setCurrentChapterId(art.currentChapterId || initChapters[0]?.id || null);
    setSkeleton(art.storySkeleton || null);
  }, [bookId]);

  // ========== 轮询：生成中同步数据 ==========
  useEffect(() => {
    if (!bookId) return;
    if (!isBookGenerating && !isChapterGenerating && !isGenerating) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = window.setInterval(() => {
      const state = loadCreationState();
      const art = state.articles.find((a) => a.id === bookId) || null;
      if (!art) return;
      setChapters(art.chapters);

      const genId = getGeneratingChapterId();
      if (genId && currentChapterId !== genId) {
        setCurrentChapterId(genId);
        if (editorRef.current) {
          const ch = art.chapters.find((c) => c.id === genId);
          if (ch) {
            editorRef.current.innerHTML = ch.content || '';
          }
        }
      }

      // 同步流式文本
      if (isChapterGenerating || isBookGenerating) {
        setStreamingText(getChapterStreamingText() || '');
      } else if (isGenerating) {
        setStreamingText(getNovelStreamingText() || '');
      }
    }, 1200);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isBookGenerating, isChapterGenerating, isGenerating, bookId, currentChapterId, getGeneratingChapterId, getChapterStreamingText, getNovelStreamingText]);

  const currentChapter = chapters.find((c) => c.id === currentChapterId) || null;

  // ========== 自动保存 ==========
  const autoSave = useCallback(() => {
    if (!bookId || !currentChapterId || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const state = loadCreationState();
    const next = updateArticleById(state, bookId, (a) => {
      const updatedChapters = a.chapters.map((c) =>
        c.id === currentChapterId
          ? {
              ...c,
              content,
              status: c.status === 'unwritten' ? 'edited' : c.status,
              lastModified: Date.now(),
            }
          : c
      );
      return { ...a, chapters: updatedChapters };
    });
    saveCreationState(next);
    setChapters(
      chapters.map((c) =>
        c.id === currentChapterId
          ? { ...c, content, status: c.status === 'unwritten' ? 'edited' : c.status, lastModified: Date.now() }
          : c
      )
    );
  }, [bookId, currentChapterId, chapters]);

  // ========== 编辑器输入 ==========
  const handleEditorInput = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setSaving(true);
    saveTimerRef.current = window.setTimeout(() => {
      autoSave();
      setSaving(false);
      toast.success('已保存', { id: 'save-chapter' });
    }, 800);
  }, [autoSave]);

  // ========== 选区工具栏 ==========
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
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // ========== 格式化命令 ==========
  const handleCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    autoSave();
  }, [autoSave]);

  // ========== 选择章节 ==========
  const handleSelectChapter = useCallback(
    (chapterId: string) => {
      if (!bookId) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      autoSave();
      setCurrentChapterId(chapterId);
      const state = loadCreationState();
      const next = setArticleChapterId(state, bookId, chapterId);
      saveCreationState(next);
    },
    [bookId, autoSave]
  );

  // ========== 新增章节 ==========
  const handleAddChapter = useCallback(() => {
    if (!bookId) return;
    const state = loadCreationState();
    const art = state.articles.find((a) => a.id === bookId);
    if (!art) return;
    const nextNum = art.chapters.length + 1;
    const newChapter: IChapter = {
      id: `ch_${Date.now()}`,
      chapterNumber: String(nextNum),
      chapterTitle: `第${nextNum}章 新章节`,
      chapterSummary: '',
      coreEvent: '',
      characters: '',
      sceneLocation: '',
      moodTone: '',
      chapterStart: '',
      chapterEnd: '',
      foreshadowing: '',
      phase: '发展',
      content: '',
      status: 'unwritten' as const,
      lastModified: Date.now(),
    };
    const next = updateArticleById(state, bookId, (a) => ({
      ...a,
      chapters: [...a.chapters, newChapter],
      currentChapterId: newChapter.id,
    }));
    saveCreationState(next);
    setChapters([...chapters, newChapter]);
    setCurrentChapterId(newChapter.id);
  }, [bookId, chapters]);

  // ========== AI 插入文本 ==========
  const handleInsertText = useCallback(
    (text: string) => {
      if (!editorRef.current) return;
      const selection = window.getSelection();
      const editor = editorRef.current;
      const htmlText = text
        .split('\n')
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${p}</p>`)
        .join('');
      if (selection && !selection.isCollapsed && editor.contains(selection.anchorNode)) {
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
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.innerHTML += htmlText;
        editor.scrollTop = editor.scrollHeight;
      }
      autoSave();
    },
    [autoSave]
  );

  // ========== 替换选区文本 ==========
  const handleReplaceSelection = useCallback(
    (text: string) => {
      if (!editorRef.current) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        handleInsertText(text);
        return;
      }
      const htmlText = text
        .split('\n')
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${p}</p>`)
        .join('');
      document.execCommand('insertHTML', false, htmlText);
      autoSave();
    },
    [autoSave, handleInsertText]
  );

  // ========== 生成章节 ==========
  const handleGenerateChapter = useCallback(
    async (chapterId: string) => {
      if (!bookId || !skeleton) {
        toast.warning('请先生成故事骨架');
        return;
      }
      const chapter = chapters.find((c) => c.id === chapterId);
      if (!chapter) return;
      if (chapterId !== currentChapterId) {
        handleSelectChapter(chapterId);
      }
      if (chapter.content && chapter.content.trim().length > 0) {
        setShowRegenerateConfirm(true);
        return;
      }
      startGeneration();
    },
    [bookId, chapters, currentChapterId, skeleton, handleSelectChapter]
  );

  const startGeneration = useCallback(async () => {
    if (!currentChapter || !skeleton || !bookId) return;
    const state = loadCreationState();
    const art = state.articles.find((a) => a.id === bookId);
    const input = buildChapterGenerationInput(currentChapter, skeleton, art?.chapters || chapters, customPrompt);
    await startChapterGeneration({
      chapterId: currentChapter.id,
      pluginId: 'novel_content_generate_1',
      input,
      articleId: bookId,
    });
    setCustomPrompt('');
    setShowRegenerateConfirm(false);
  }, [currentChapter, skeleton, bookId, chapters, customPrompt, startChapterGeneration]);

  // ========== 生成下一章 ==========
  const handleGenerateNextChapter = useCallback(async () => {
    if (!currentChapterId) return;
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    if (idx < 0 || idx >= chapters.length - 1) return;
    const nextChapterId = chapters[idx + 1].id;
    handleGenerateChapter(nextChapterId);
  }, [currentChapterId, chapters, handleGenerateChapter]);

  const hasNextChapter = useMemo(() => {
    if (!currentChapterId) return false;
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    return idx >= 0 && idx < chapters.length - 1;
  }, [currentChapterId, chapters]);

  // ========== 整本书生成 ==========
  const handleGenerateBook = useCallback(() => {
    if (!currentChapter || !skeleton || isBookGenerating) return;
    setShowBookDialog(true);
  }, [currentChapter, skeleton, isBookGenerating]);

  const startBookGenerationFrom = useCallback(
    async (mode: 'fromCurrent' | 'fromStart') => {
      if (!skeleton || !bookId) return;
      setShowBookDialog(false);
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
        articleId: bookId,
      });
    },
    [skeleton, bookId, chapters, currentChapter, customPrompt, startBookGeneration]
  );

  // ========== 续写 / 润色 / 扩写 ==========
  const handleFineTuneAction = useCallback(
    async (action: 'continue' | 'polish' | 'expand') => {
      if (!currentChapter || isGenerating || !bookId) return;
      const chapterContent = currentChapter.content || '';
      let pluginId = 'novel_content_generate_1';
      let input: any = {};
      let isReplace = false;
      let taskType: 'novel_continue' | 'novel_polish' | 'novel_expand' = 'novel_continue';

      const mainChars = skeleton?.characterSettings
        .slice(0, 3)
        .map((c) => `${c.name}（${c.identity}）`)
        .join('、');
      const ch = currentChapter as any;
      const outlineContext = [
        skeleton ? `故事背景：${skeleton.worldView.background}` : '',
        mainChars ? `主要人物：${mainChars}` : '',
        `当前章节：第${ch?.chapterNumber || ''}章 ${ch?.chapterTitle || ''}`,
        ch?.chapterSummary ? `章节概要：${ch.chapterSummary}` : '',
      ].filter(Boolean).join('\n');

      if (action === 'continue') {
        taskType = 'novel_continue';
        input = {
          novel_outline: outlineContext,
          current_context: chapterContent,
          generation_requirement: '续写当前章节，承接上下文，自然推进剧情，约800-1000字',
        };
      } else if (action === 'polish') {
        taskType = 'novel_polish';
        if (!selectedText) {
          toast.info('请先选中要润色的段落');
          return;
        }
        pluginId = 'novel_content_polishing_1';
        input = { novel_paragraph: selectedText };
        isReplace = true;
      } else if (action === 'expand') {
        taskType = 'novel_expand';
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
          handleReplaceSelection(text);
        } else {
          handleInsertText(text);
        }
      };

      await startNovelGeneration(taskType, pluginId, input, currentChapter.id, applyResult, bookId);
      setCustomPrompt('');
    },
    [currentChapter, isGenerating, bookId, skeleton, selectedText, customPrompt, handleInsertText, handleReplaceSelection, startNovelGeneration]
  );

  // ========== 进度 / 字数 ==========
  const progress = useMemo(() => {
    if (chapters.length === 0) return { generated: 0, total: 0, percent: 0 };
    const generated = chapters.filter((c) => c.status !== 'unwritten').length;
    return { generated, total: chapters.length, percent: Math.round((generated / chapters.length) * 100) };
  }, [chapters]);

  const currentWordCount = useMemo(() => {
    if (!currentChapter) return 0;
    return countWords(currentChapter.content || '');
  }, [currentChapter]);

  const totalWordCount = useMemo(() => {
    return chapters.reduce((sum, c) => sum + countWords(c.content || ''), 0);
  }, [chapters]);

  const handlePause = useCallback(() => {
    if (isBookGenerating) pauseTask('novel_book_generate');
    else if (isTaskRunning('novel_chapter_generate')) pauseTask('novel_chapter_generate');
  }, [isBookGenerating, isTaskRunning, pauseTask]);

  const handleResume = useCallback(() => {
    if (bookPauseStatus === 'paused') resumeTask('novel_book_generate');
    else if (getTaskPauseStatus('novel_chapter_generate') === 'paused') resumeTask('novel_chapter_generate');
  }, [bookPauseStatus, getTaskPauseStatus, resumeTask]);

  const handleStop = useCallback(() => {
    if (isBookGenerating || bookPauseStatus === 'paused') stopTask('novel_book_generate');
    else if (isTaskRunning('novel_chapter_generate') || getTaskPauseStatus('novel_chapter_generate') === 'paused') stopTask('novel_chapter_generate');
  }, [isBookGenerating, bookPauseStatus, isTaskRunning, getTaskPauseStatus, stopTask]);

  const isSingleChapterPaused = getTaskPauseStatus('novel_chapter_generate') === 'paused';
  const generatingChapterId = getGeneratingChapterId();

  // 无 bookId → 显示友好提示（绝不能返回 null 导致白屏）
  if (!bookId) {
    return (
      <div className="flex flex-1 min-h-0 w-full items-center justify-center">
        <div className="mx-auto w-full max-w-md px-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">书籍 ID 无效</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            未找到对应的书籍信息，请返回书架重新选择。
          </p>
          <Button className="mt-6 gap-2" onClick={() => navigate('/books')}>
            <ArrowLeft className="size-4" />
            返回书架
          </Button>
        </div>
      </div>
    );
  }

  // 无文章数据 → 加载/空状态（避免 article 为 null 时后续渲染崩溃）
  if (!article) {
    return (
      <div className="flex flex-1 min-h-0 w-full items-center justify-center">
        <div className="mx-auto w-full max-w-md px-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">未找到该书籍</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            这本小说可能已被删除，或者链接不正确。
          </p>
          <Button className="mt-6 gap-2" onClick={() => navigate('/books')}>
            <ArrowLeft className="size-4" />
            返回书架
          </Button>
        </div>
      </div>
    );
  }

  // 无章节且无骨架 → 空状态引导
  const showEmptyState = chapters.length === 0 && !skeleton;

  if (showEmptyState) {
    return (
      <div className="flex flex-1 min-h-0 w-full items-center justify-center">
        <div className="mx-auto w-full max-w-md px-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">还没有章节规划</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            请先返回大纲页面，生成故事骨架和章节规划后，再来开始创作吧。
          </p>
          <Button
            className="mt-6 gap-2"
            onClick={() => navigate(`/books/${bookId}`)}
          >
            <ArrowLeft className="size-4" />
            返回大纲
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
        {/* ========== 顶部信息栏 ========== */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur">
          {/* 左侧：返回 + 书名 + 章节 */}
          <div className="flex items-center gap-3 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(`/books/${bookId}`)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>返回大纲</TooltipContent>
            </Tooltip>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <BookMarked className="size-4 text-primary shrink-0" />
                <span className="text-sm font-semibold truncate">{article?.title || '未命名小说'}</span>
                <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                  {article?.lengthType || '中篇'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {currentChapter
                  ? `第${currentChapter.chapterNumber}章 · ${currentChapter.chapterTitle}`
                  : '未选择章节'}
              </div>
            </div>
          </div>

          {/* 中间：字数 + 保存状态 */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5" />
                <span>本章 <span className="font-medium text-foreground tabular-nums">{currentWordCount.toLocaleString()}</span> 字</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" />
                <span>全书 <span className="font-medium text-foreground tabular-nums">{totalWordCount.toLocaleString()}</span> 字</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5 text-success" />
                  <span>已保存</span>
                </>
              )}
            </div>
          </div>

          {/* 右侧：折叠控制 + 专注模式 */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setLeftOpen((v) => !v)}
                >
                  <PanelLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{leftOpen ? '收起章节列表' : '展开章节列表'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleFocusMode}
                >
                  {focusMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{focusMode ? '退出专注模式' : '专注模式'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setRightOpen((v) => !v)}
                >
                  <PanelRight className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{rightOpen ? '收起AI助手' : '展开AI助手'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ========== 三栏主区域 ========== */}
        <div className="relative flex flex-1 min-h-0 w-full overflow-hidden">
          {/* ---- 左栏：章节列表 ---- */}
          <AnimatePresence initial={false}>
            {leftOpen && !focusMode && (
              <motion.aside
                key="left-sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="shrink-0 flex-col border-r border-border bg-muted/20 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                  <h3 className="text-sm font-semibold">章节列表</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleAddChapter}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="新增章节"
                      >
                        <Plus className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>新增章节</TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex-1 overflow-y-auto py-1.5">
                  {chapters.map((ch) => {
                    const isActive = ch.id === currentChapterId;
                    const isGen = isChapterGenerating && generatingChapterId === ch.id;
                    const chWords = countWords(ch.content || '');
                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleSelectChapter(ch.id)}
                        className={cn(
                          'group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground hover:bg-accent/60'
                        )}
                      >
                        <div
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-medium',
                            isActive
                              ? 'bg-primary/20 text-primary'
                              : isGen
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isGen ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            ch.chapterNumber
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{ch.chapterTitle}</div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {ch.status === 'edited' && <Edit3 className="size-3 text-success" />}
                            {ch.status === 'generated' && <FileText className="size-3 text-primary" />}
                            {ch.status === 'unwritten' && !isGen && <Lock className="size-3 opacity-50" />}
                            <span className="tabular-nums">{chWords.toLocaleString()} 字</span>
                          </div>
                        </div>
                        {isActive && <Check className="size-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* 底部进度 */}
                <div className="border-t border-border px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>全书进度</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {progress.generated}/{progress.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* ---- 中栏：编辑器 ---- */}
          <main
            className={cn(
              'flex flex-1 min-w-0 flex-col overflow-hidden transition-all duration-300',
              focusMode ? 'items-center' : ''
            )}
          >
            {/* 编辑器顶部工具栏 */}
            <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-card/50 px-3">
              <ToolbarButton icon={<Heading1 className="size-3.5" />} onClick={() => handleCommand('formatBlock', 'h1')} title="一级标题" />
              <ToolbarButton icon={<Heading2 className="size-3.5" />} onClick={() => handleCommand('formatBlock', 'h2')} title="二级标题" />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <ToolbarButton icon={<Bold className="size-3.5" />} onClick={() => handleCommand('bold')} title="加粗" />
              <ToolbarButton icon={<Italic className="size-3.5" />} onClick={() => handleCommand('italic')} title="斜体" />
              <ToolbarButton icon={<Underline className="size-3.5" />} onClick={() => handleCommand('underline')} title="下划线" />
              <ToolbarButton icon={<Strikethrough className="size-3.5" />} onClick={() => handleCommand('strikeThrough')} title="删除线" />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <ToolbarButton icon={<ListIcon className="size-3.5" />} onClick={() => handleCommand('insertUnorderedList')} title="无序列表" />
              <ToolbarButton icon={<ListOrdered className="size-3.5" />} onClick={() => handleCommand('insertOrderedList')} title="有序列表" />
              <ToolbarButton icon={<Quote className="size-3.5" />} onClick={() => handleCommand('formatBlock', 'blockquote')} title="引用" />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <ToolbarButton icon={<AlignLeft className="size-3.5" />} onClick={() => handleCommand('justifyLeft')} title="左对齐" />
              <ToolbarButton icon={<AlignCenter className="size-3.5" />} onClick={() => handleCommand('justifyCenter')} title="居中" />
              <ToolbarButton icon={<AlignRight className="size-3.5" />} onClick={() => handleCommand('justifyRight')} title="右对齐" />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <ToolbarButton icon={<Undo className="size-3.5" />} onClick={() => handleCommand('undo')} title="撤销" />
              <ToolbarButton icon={<Redo className="size-3.5" />} onClick={() => handleCommand('redo')} title="重做" />
            </div>

            {/* 编辑区 - 纸张效果 */}
            <div
              className={cn(
                'relative flex-1 overflow-y-auto',
                focusMode ? 'bg-muted/30' : 'bg-background'
              )}
            >
              <div
                className={cn(
                  'mx-auto h-full',
                  focusMode ? 'max-w-[800px] py-12' : 'w-full'
                )}
              >
                {currentChapter ? (
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    className={cn(
                      'h-full min-h-full outline-none focus:outline-none',
                      'prose prose-sm max-w-none',
                      focusMode
                        ? 'rounded-xl bg-card px-16 py-12 shadow-sm border border-border/50 text-base leading-[1.9]'
                        : 'px-8 py-6 text-base leading-[1.8]'
                    )}
                    style={{ whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: currentChapter.content || '' }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <FileText className="mx-auto mb-3 size-10 opacity-40" />
                      <p>从左侧选择一个章节开始创作</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 浮动选区工具栏 */}
              <EditorToolbar
                visible={toolbarVisible}
                position={toolbarPos}
                onCommand={handleCommand}
              />
            </div>

            {/* 编辑器底部状态栏 */}
            <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/50 px-4 text-[11px] text-muted-foreground">
              <span>行 1 · 列 1</span>
              <span className="tabular-nums">{currentWordCount.toLocaleString()} 字 / {chapters.length} 章</span>
            </div>
          </main>

          {/* ---- 右栏：AI助手 ---- */}
          <AnimatePresence initial={false}>
            {rightOpen && !focusMode && (
              <motion.aside
                key="right-sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="shrink-0 flex-col border-l border-border bg-muted/20 overflow-hidden"
              >
                {/* 顶部标题 */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold">AI 创作助手</h3>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 p-3">
                  {/* 主操作区 */}
                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2"
                      size="default"
                      disabled={!currentChapter || isChapterGenerating || isBookGenerating}
                      onClick={() => currentChapter && handleGenerateChapter(currentChapter.id)}
                    >
                      <Sparkles className="size-4" />
                      AI 生成本章
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      disabled={!currentChapter || isBookGenerating || isChapterGenerating}
                      onClick={handleGenerateBook}
                    >
                      <BookOpen className="size-4" />
                      AI 生成整本书
                    </Button>

                    {/* 生成中进度卡 */}
                    <AnimatePresence>
                      {(isBookGenerating || isChapterGenerating || isSingleChapterPaused || isBookPaused) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                            {isBookGenerating || isBookPaused ? (
                              <>
                                <div className="flex items-center gap-2 text-xs">
                                  <BookOpen className="size-3.5 text-primary" />
                                  <span className="font-medium">整本书生成中</span>
                                  <Badge variant="outline" className="ml-auto text-[10px]">
                                    {bookProgress ? `${bookProgress.currentIndex + 1}/${bookProgress.total}` : '--'}
                                  </Badge>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: bookProgress ? `${((bookProgress.currentIndex + 1) / bookProgress.total) * 100}%` : '0%' }}
                                  />
                                </div>
                                <div className="flex gap-1.5">
                                  {isBookPaused ? (
                                    <>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handleResume}>
                                        <Play className="size-3 mr-1" />继续
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-destructive" onClick={handleStop}>
                                        <Square className="size-3 mr-1" />停止
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handlePause}>
                                        <Pause className="size-3 mr-1" />暂停
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-destructive" onClick={handleStop}>
                                        <Square className="size-3 mr-1" />停止
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </>
                            ) : isChapterGenerating || isSingleChapterPaused ? (
                              <>
                                <div className="flex items-center gap-2 text-xs">
                                  <Loader2 className="size-3.5 animate-spin text-primary" />
                                  <span className="font-medium">本章生成中</span>
                                  <span className="ml-auto text-muted-foreground tabular-nums">
                                    {getChapterStreamingText()?.length || 0} 字
                                  </span>
                                </div>
                                <div className="rounded-md bg-muted/50 p-2">
                                  <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                                    {getChapterStreamingText() || '正在构思...'}
                                  </p>
                                </div>
                                <div className="flex gap-1.5">
                                  {isSingleChapterPaused ? (
                                    <>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handleResume}>
                                        <Play className="size-3 mr-1" />继续
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-destructive" onClick={handleStop}>
                                        <Square className="size-3 mr-1" />停止
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handlePause}>
                                        <Pause className="size-3 mr-1" />暂停
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-destructive" onClick={handleStop}>
                                        <Square className="size-3 mr-1" />停止
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <Separator />

                  {/* 微调工具区 */}
                  <CollapsibleSection
                    title="微调工具"
                    icon={<Wand2 className="size-3.5" />}
                    open={fineTuneOpen}
                    onToggle={() => setFineTuneOpen((v) => !v)}
                  >
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!currentChapter || isGenerating}
                          onClick={() => handleFineTuneAction('continue')}
                        >
                          续写
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!currentChapter || isGenerating}
                          onClick={() => handleFineTuneAction('polish')}
                        >
                          润色
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!currentChapter || isGenerating}
                          onClick={() => handleFineTuneAction('expand')}
                        >
                          扩写
                        </Button>
                      </div>
                      <Textarea
                        placeholder="自定义生成指令（可选）"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="h-16 resize-none text-xs"
                      />
                    </div>
                  </CollapsibleSection>

                  <Separator />

                  {/* 本章信息区 */}
                  {currentChapter && (
                    <CollapsibleSection
                      title="本章规划"
                      icon={<Info className="size-3.5" />}
                      open={chapterInfoOpen}
                      onToggle={() => setChapterInfoOpen((v) => !v)}
                    >
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{currentChapter.phase}</Badge>
                          <span className="font-medium truncate">{currentChapter.chapterTitle}</span>
                        </div>
                        {currentChapter.coreEvent && (
                          <InfoRow label="核心事件" value={currentChapter.coreEvent} />
                        )}
                        {currentChapter.characters && (
                          <InfoRow label="出场人物" value={currentChapter.characters} />
                        )}
                        {currentChapter.moodTone && (
                          <InfoRow label="情绪基调" value={currentChapter.moodTone} />
                        )}
                        {currentChapter.sceneLocation && (
                          <InfoRow label="场景地点" value={currentChapter.sceneLocation} />
                        )}
                        {currentChapter.chapterEnd && (
                          <InfoRow label="本章终点" value={currentChapter.chapterEnd} />
                        )}

                        {/* 连贯性提示 */}
                        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-primary/5 p-2">
                          <AlertCircle className="size-3.5 text-primary shrink-0 mt-0.5" />
                          <p className="text-[11px] leading-relaxed text-primary/90">
                            生成时会自动参考前文内容，确保情节连贯
                          </p>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* ========== 重新生成确认 ========== */}
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

        {/* ========== 整本书生成确认 ========== */}
        <AlertDialog open={showBookDialog} onOpenChange={setShowBookDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                生成整本书
              </AlertDialogTitle>
              <AlertDialogDescription>
                请选择生成范围：
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => startBookGenerationFrom('fromCurrent')}
              >
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">从本章开始</div>
                  <div className="text-xs text-muted-foreground">
                    从当前章节开始，逐章生成到最后一章
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => startBookGenerationFrom('fromStart')}
              >
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">从第一章重新生成</div>
                  <div className="text-xs text-muted-foreground">
                    从第一章开始，重新生成整本书所有章节
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

// ========== 子组件：工具栏按钮 ==========
function ToolbarButton({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      {icon}
    </button>
  );
}

// ========== 子组件：可折叠区块 ==========
function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ========== 子组件：信息行 ==========
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted-foreground">{label}：</span>
      <span className="flex-1 text-foreground line-clamp-2">{value}</span>
    </div>
  );
}
