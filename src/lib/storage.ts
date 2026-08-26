import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import type { ICreationState, INovelArticle, IStorySkeleton, IChapter, NovelLengthType, IOutlineCard, ICategory } from '@/data/novel';
import { INITIAL_CREATION_STATE } from '@/data/novel';

const STATE_KEY = 'novel_creation_state';

function deepMergeState(parsed: Partial<ICreationState>): ICreationState {
  return {
    ...INITIAL_CREATION_STATE,
    ...parsed,
  };
}

export function loadCreationState(): ICreationState {
  try {
    const raw = scopedStorage.getItem(STATE_KEY);
    if (!raw) return { ...INITIAL_CREATION_STATE };
    const parsed = JSON.parse(raw) as Partial<ICreationState>;
    return deepMergeState(parsed);
  } catch {
    return { ...INITIAL_CREATION_STATE };
  }
}

export function saveCreationState(state: ICreationState) {
  try {
    scopedStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearCreationState() {
  try {
    scopedStorage.removeItem(STATE_KEY);
  } catch {
    // ignore
  }
}

// ========== 文章级操作 ==========

/** 生成文章 ID */
export function genArticleId(): string {
  return `article_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建一篇新文章 */
export function createArticle(params: {
  title: string;
  lengthType: NovelLengthType;
  category: ICategory | null;
  outline: IOutlineCard | null;
}): INovelArticle {
  const now = Date.now();
  return {
    id: genArticleId(),
    title: params.title,
    lengthType: params.lengthType,
    category: params.category,
    outline: params.outline,
    storySkeleton: null,
    chapters: [],
    currentChapterId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** 获取当前文章 */
export function getCurrentArticle(state: ICreationState): INovelArticle | null {
  if (!state.currentArticleId) return null;
  return state.articles.find((a) => a.id === state.currentArticleId) || null;
}

/** 更新当前文章（统一 updatedAt） */
export function updateCurrentArticle(
  state: ICreationState,
  updater: (article: INovelArticle) => INovelArticle
): ICreationState {
  if (!state.currentArticleId) return state;
  const updatedArticles = state.articles.map((a) =>
    a.id === state.currentArticleId ? { ...updater(a), updatedAt: Date.now() } : a
  );
  return { ...state, articles: updatedArticles };
}

/** 添加文章并设为当前 */
export function addArticle(state: ICreationState, article: INovelArticle): ICreationState {
  return {
    ...state,
    articles: [...state.articles, article],
    currentArticleId: article.id,
  };
}

/** 切换当前文章 */
export function setCurrentArticle(state: ICreationState, articleId: string): ICreationState {
  const exists = state.articles.some((a) => a.id === articleId);
  if (!exists) return state;
  return { ...state, currentArticleId: articleId };
}

/** 写入骨架到当前文章 */
export function setArticleSkeleton(
  state: ICreationState,
  skeleton: IStorySkeleton,
  chapters?: IChapter[]
): ICreationState {
  return updateCurrentArticle(state, (a) => ({
    ...a,
    storySkeleton: skeleton,
    chapters: chapters ?? a.chapters,
    currentChapterId: chapters && chapters.length > 0 ? chapters[0].id : a.currentChapterId,
  }));
}

/** 更新当前文章的章节列表 */
export function setArticleChapters(state: ICreationState, chapters: IChapter[]): ICreationState {
  return updateCurrentArticle(state, (a) => ({ ...a, chapters }));
}

/** 更新当前文章的当前章节 ID */
export function setArticleCurrentChapterId(state: ICreationState, chapterId: string | null): ICreationState {
  return updateCurrentArticle(state, (a) => ({ ...a, currentChapterId: chapterId }));
}

/** 更新指定文章的当前章节 ID（传 articleId） */
export function setArticleChapterId(state: ICreationState, articleId: string, chapterId: string | null): ICreationState {
  return {
    ...state,
    articles: state.articles.map((a) =>
      a.id === articleId ? { ...a, currentChapterId: chapterId } : a
    ),
  };
}

/** 设置当前选中的品类 */
export function setSelectedCategory(state: ICreationState, category: ICategory | null): ICreationState {
  return { ...state, selectedCategory: category };
}

/** 删除指定文章，若为当前文章则自动切换到下一篇或置空 */
export function deleteArticle(state: ICreationState, articleId: string): ICreationState {
  const remaining = state.articles.filter((a) => a.id !== articleId);
  let nextCurrentId = state.currentArticleId;
  if (state.currentArticleId === articleId) {
    nextCurrentId = remaining.length > 0 ? remaining[0].id : null;
  }
  return {
    ...state,
    articles: remaining,
    currentArticleId: nextCurrentId,
  };
}
const THEME_KEY = 'novel_theme';

export function loadTheme(): 'light' | 'dark' {
  try {
    const raw = scopedStorage.getItem(THEME_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
    return 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark') {
  try {
    scopedStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
