// EXPORTS: ICategory, ICategoryResearchData, IOutlineCard, ICharacter, IWorldSetting, IPlotNode, IStructure, IChapterMeta, IChapter, IStorySkeleton, INovelArticle, NovelLengthType, ICreationState, INITIAL_CREATION_STATE
// 小说创作全流程辅助平台 - 类型定义与初始状态

// 品类调研单项
export interface ICategory {
  id: string;
  name: string;
  heatIndex: number;
  competitionLevel: string;
  competitionScore: number;
  readerProfile: {
    ageDistribution: string[];
    genderRatio: { malePercent: number; femalePercent: number };
    interestTags: string[];
    readingPreferences: string[];
  };
  growthTrend: {
    past3MonthsTrend: string;
    past3MonthsGrowthRate: number;
    future3MonthsForecast: string;
    future3MonthsExpectedGrowthRate: number;
    monthlyData: { month: string; value: number }[];
  };
  dimensionScores: {
    marketPotential: number;
    monetizationPotential: number;
    creativeDifficulty: number;
    readerStickiness: number;
    developmentProspect: number;
  };
  hotKeywords: string[];
  representativeWorks: { workName: string; author: string; popularity: string }[];
  developmentSuggestions: string;
  description: string;
}

// 品类调研整体数据
export interface ICategoryResearchData {
  categories: ICategory[];
  generatedAt: number;
}

// 一句话大纲卡片
export interface IOutlineCard {
  id: string;
  title: string;
  concept: string;
  tags: string[];
}

// 人物设定
export interface ICharacter {
  id: string;
  name: string;
  identity: string;
  personality: string;
  coreDemand: string;
  characterArc: string;
}

// 世界观设定
export interface IWorldSetting {
  background: string;
  rules: string;
  coreConflictEnvironment: string;
}

// 剧情节点
export interface IPlotNode {
  id: string;
  nodeName: string;
  nodeContent: string;
  importance: string;
}

// 起承转合结构
export interface IStructure {
  opening: string;
  development: string;
  climax: string;
  ending: string;
}

// 章节元信息
export interface IChapterMeta {
  id: string;
  chapterNumber: string;
  chapterTitle: string;
  chapterSummary: string;
  coreEvent: string;
}

// 章节完整数据（含正文）
export interface IChapter extends IChapterMeta {
  content: string;
  status: 'unwritten' | 'generated' | 'edited';
  lastModified: number;
}

// 故事骨架
export interface IStorySkeleton {
  characterSettings: ICharacter[];
  worldView: IWorldSetting;
  plotNodes: IPlotNode[];
  narrativeStructure: IStructure;
  chapterPlan: IChapterMeta[];
}

// 文章篇幅类型
export type NovelLengthType = 'short' | 'medium' | 'long';

export const NOVEL_LENGTH_OPTIONS: Record<NovelLengthType, { label: string; wordRange: string; chapterRange: string; suggestedChapters: number }> = {
  short: { label: '短篇', wordRange: '约1-3万字', chapterRange: '建议5-15章', suggestedChapters: 10 },
  medium: { label: '中篇', wordRange: '约10-30万字', chapterRange: '建议30-80章', suggestedChapters: 50 },
  long: { label: '长篇', wordRange: '约50万字以上', chapterRange: '建议100章以上', suggestedChapters: 100 },
};

// 单篇文章（独立的创作单元）
export interface INovelArticle {
  id: string;
  title: string;
  lengthType: NovelLengthType;
  category: ICategory | null;
  outline: IOutlineCard | null;
  storySkeleton: IStorySkeleton | null;
  chapters: IChapter[];
  currentChapterId: string | null;
  createdAt: number;
  updatedAt: number;
}

// 全局创作状态
export interface ICreationState {
  categoryResearchData: ICategoryResearchData | null;
  selectedCategory: ICategory | null;
  outlineList: IOutlineCard[];
  selectedOutline: IOutlineCard | null;
  // 以下字段已迁移到单篇文章（INovelArticle），保留仅用于向后兼容旧数据
  storySkeleton: IStorySkeleton | null;
  chapters: IChapter[];
  currentChapterId: string | null;
  // 多篇文章
  articles: INovelArticle[];
  currentArticleId: string | null;
}

export const INITIAL_CREATION_STATE: ICreationState = {
  categoryResearchData: null,
  selectedCategory: null,
  outlineList: [],
  selectedOutline: null,
  storySkeleton: null,
  chapters: [],
  currentChapterId: null,
  articles: [],
  currentArticleId: null,
};
