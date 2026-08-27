// EXPORTS: buildChapterGenerationInput, ensureSafeCurrentContext
import type { IChapter, IStorySkeleton } from '@/data/novel';

/**
 * 构建整章生成所需的插件入参
 * 保证 novel_outline / current_context 两个必填字段始终有非空值，避免插件校验失败
 */
export function buildChapterGenerationInput(
  chapter: IChapter,
  skeleton: IStorySkeleton | null,
  allChapters: IChapter[],
  extraRequirement = ''
): {
  novel_outline: string;
  current_context: string;
  generation_requirement: string;
} {
  const idx = allChapters.findIndex((c) => c.id === chapter.id);
  const prevChapters = idx >= 0 ? allChapters.slice(0, idx) : [];

  // ========== novel_outline：故事骨架 + 章节规划 ==========
  const outlineParts: string[] = [];

  if (skeleton?.characterSettings?.length) {
    const chars = skeleton.characterSettings
      .slice(0, 5)
      .map(
        (c) =>
          `${c.name}（${c.identity}）：${[c.personality, c.coreDemand].filter(Boolean).join('；') || '暂无详细设定'}`
      )
      .join('\n');
    if (chars) outlineParts.push(`【主要人物】\n${chars}`);
  }

  if (skeleton?.worldView) {
    const wv = skeleton.worldView;
    const wvParts = [wv.background, wv.rules, wv.coreConflictEnvironment].filter(Boolean);
    if (wvParts.length) outlineParts.push(`【世界观设定】\n${wvParts.join('\n')}`);
  }

  if (skeleton?.narrativeStructure) {
    const ns = skeleton.narrativeStructure;
    const nsParts = [
      ns.opening && `起：${ns.opening}`,
      ns.development && `承：${ns.development}`,
      ns.climax && `转：${ns.climax}`,
      ns.ending && `合：${ns.ending}`,
    ].filter(Boolean);
    if (nsParts.length) outlineParts.push(`【整体剧情结构】\n${nsParts.join('\n')}`);
  }

  // 章节规划（本章完整规划 + 前后各 1 章，让 AI 知道前后衔接）
  if (allChapters.length > 0) {
    const planLines: string[] = [];
    const planStart = Math.max(0, idx - 1);
    const planEnd = Math.min(allChapters.length, idx + 2);
    for (let i = planStart; i < planEnd; i++) {
      const ch = allChapters[i];
      const marker = i === idx ? ' ← 当前章' : '';
      planLines.push(
        `第${ch.chapterNumber}章 ${ch.chapterTitle}${marker}`
      );
      if (i === idx) {
        // 当前章：完整详细规划
        if (ch.coreEvent) planLines.push(`  核心事件：${ch.coreEvent}`);
        if (ch.characters) planLines.push(`  出场人物：${ch.characters}`);
        if (ch.sceneLocation) planLines.push(`  场景地点：${ch.sceneLocation}`);
        if (ch.moodTone) planLines.push(`  情绪基调：${ch.moodTone}`);
        if (ch.chapterStart) planLines.push(`  本章起点：${ch.chapterStart}`);
        if (ch.chapterEnd) planLines.push(`  本章终点：${ch.chapterEnd}`);
        if (ch.foreshadowing) planLines.push(`  伏笔悬念：${ch.foreshadowing}`);
        if ((ch as any).phase) planLines.push(`  剧情阶段：${(ch as any).phase}`);
      } else {
        // 前后章：重点传终点/起点
        if (i < idx && ch.chapterEnd) {
          planLines.push(`  上章终点（悬念/过渡）：${ch.chapterEnd}`);
        }
        if (i > idx && ch.chapterStart) {
          planLines.push(`  下章起点：${ch.chapterStart}`);
        }
        if (ch.chapterSummary) planLines.push(`  概要：${ch.chapterSummary}`);
      }
    }
    if (planLines.length) outlineParts.push(`【章节规划（前后衔接）】\n${planLines.join('\n')}`);
  }

  // 必填兜底：骨架为空时也至少有章节信息
  const novel_outline = outlineParts.length
    ? outlineParts.join('\n\n')
    : `小说章节：第${chapter.chapterNumber}章 ${chapter.chapterTitle}\n${chapter.chapterSummary || ''}`;

  // ========== current_context：前面已生成章节的正文 ==========
  let current_context = '';
  if (prevChapters.length > 0) {
    const prevTexts: string[] = [];
    let totalLen = 0;
    // 倒序遍历，最近的优先保留全文摘要，更久的只留概要
    for (let i = prevChapters.length - 1; i >= 0; i--) {
      const ch = prevChapters[i];
      const plain = (ch.content || '').replace(/<[^>]+>/g, '').trim();
      const distance = prevChapters.length - i;

      if (!plain) {
        // 没有正文，留概要
        prevTexts.unshift(
          `【第${ch.chapterNumber}章 ${ch.chapterTitle}】${ch.chapterSummary || '概要待补充'}`
        );
        continue;
      }

      if (distance <= 3) {
        // 最近 3 章保留部分正文
        const snippet = plain.slice(0, 800);
        prevTexts.unshift(
          `【第${ch.chapterNumber}章 ${ch.chapterTitle}】\n${snippet}${plain.length > 800 ? '\n...（内容有删减）' : ''}`
        );
        totalLen += snippet.length;
        if (totalLen > 2500) break;
      } else {
        // 更早的章节只留概要
        prevTexts.unshift(
          `【第${ch.chapterNumber}章 ${ch.chapterTitle}】${ch.chapterSummary || '概要待补充'}`
        );
      }
    }
    current_context = prevTexts.join('\n\n');
  }

  // 必填兜底：第一章或无前文时，给一个占位说明
  if (!current_context.trim()) {
    current_context = buildFirstChapterContext(chapter);
  }

  // ========== generation_requirement：生成具体要求 ==========
  const reqParts = [
    `请生成《第${chapter.chapterNumber}章 ${chapter.chapterTitle}》的完整正文内容。`,
    chapter.chapterSummary ? `本章概要：${chapter.chapterSummary}` : '',
    (chapter as any).coreEvent ? `本章核心事件：${(chapter as any).coreEvent}` : '',
    (chapter as any).characters ? `出场人物设定：${(chapter as any).characters}` : '',
    (chapter as any).moodTone ? `情绪基调：${(chapter as any).moodTone}` : '',
    (chapter as any).sceneLocation ? `主要场景：${(chapter as any).sceneLocation}` : '',
    (chapter as any).chapterStart ? `本章切入点（承接上一章）：${(chapter as any).chapterStart}` : '',
    (chapter as any).chapterEnd ? `本章结尾落点：${(chapter as any).chapterEnd}` : '',
    (chapter as any).foreshadowing ? `伏笔/悬念处理：${(chapter as any).foreshadowing}` : '',
    '字数控制在2000-3000字之间，分多个自然段落，对话和描写比例合理。',
    prevChapters.length > 0
      ? '严格承接前面章节的剧情、人物关系和世界观设定，保持人物性格一致、情节连贯。开头要自然承接上一章结尾的状态和悬念，人物行动要符合前文铺垫，不能出现突兀跳跃或前后矛盾。'
      : '作为开篇章节，要做好人物登场、世界观铺垫和悬念设置，吸引读者继续阅读。',
    '请严格遵循上述章节规划，不要偏离核心事件、出场人物和情绪基调。',
    '只输出正文内容，不要章节标题，不要任何解释或说明。',
    extraRequirement.trim() ? `额外要求：${extraRequirement.trim()}` : '',
  ].filter(Boolean);

  const generation_requirement = reqParts.join('\n');

  return { novel_outline, current_context, generation_requirement };
}

/**
 * 第一章 / 无前文内容时的 current_context 占位文本
 */
export function buildFirstChapterContext(chapter: { chapterNumber?: number | string; chapterTitle?: string } = {}): string {
  return `本章为小说开篇，无前文内容，请基于故事骨架和本章章节规划直接开始创作。${
    chapter.chapterTitle ? `本章标题：${chapter.chapterTitle}` : ''
  }`;
}

/**
 * 前文章节尚未生成正文时的 current_context 占位文本
 */
export function buildPrevNotGeneratedContext(): string {
  return '前文章节尚未生成正文，请基于故事骨架和本章章节规划创作，并确保与整体剧情连贯。';
}

/**
 * current_context 最终保险兜底：确保传给插件的 current_context 永远非空
 * 在所有调用 novel_content_generate_1 插件的入口处调用
 */
export function ensureSafeCurrentContext(
  input: Record<string, any>,
  chapterInfo?: { chapterNumber?: number | string; chapterTitle?: string; content?: string }
): Record<string, any> {
  const safe = { ...input };
  const ctx = safe.current_context;
  if (ctx == null || (typeof ctx === 'string' && ctx.trim().length === 0)) {
    const cn = chapterInfo?.chapterNumber;
    const isFirst = cn === undefined || cn === null || cn === 1 || cn === '1' || String(cn) === '1';
    if (isFirst) {
      safe.current_context = buildFirstChapterContext(chapterInfo);
    } else {
      // 非第一章但没前文，用前文未生成占位
      safe.current_context = buildPrevNotGeneratedContext();
    }
  }
  return safe;
}
