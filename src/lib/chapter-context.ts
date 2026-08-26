// EXPORTS: buildChapterGenerationInput
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

  // 章节规划（本章 + 前后各 1 章，让 AI 知道前后衔接）
  if (allChapters.length > 0) {
    const planLines: string[] = [];
    const planStart = Math.max(0, idx - 1);
    const planEnd = Math.min(allChapters.length, idx + 2);
    for (let i = planStart; i < planEnd; i++) {
      const ch = allChapters[i];
      const marker = i === idx ? ' ← 当前章' : '';
      planLines.push(
        `第${ch.chapterNumber}章 ${ch.chapterTitle}${marker}：${ch.chapterSummary || '暂无概要'}`
      );
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
    current_context =
      '（本章为小说开篇，无前文内容，请基于故事骨架和本章设定直接开始创作第一章正文）';
  }

  // ========== generation_requirement：生成具体要求 ==========
  const reqParts = [
    `请生成《第${chapter.chapterNumber}章 ${chapter.chapterTitle}》的完整正文内容。`,
    chapter.chapterSummary ? `本章概要：${chapter.chapterSummary}` : '',
    chapter.coreEvent ? `本章核心事件：${chapter.coreEvent}` : '',
    '字数控制在2000-3000字之间，分多个自然段落，对话和描写比例合理。',
    prevChapters.length > 0
      ? '严格承接前面章节的剧情、人物关系和世界观设定，保持人物性格一致、情节连贯。'
      : '作为开篇章节，要做好人物登场、世界观铺垫和悬念设置，吸引读者继续阅读。',
    '只输出正文内容，不要章节标题，不要任何解释或说明。',
    extraRequirement.trim() ? `额外要求：${extraRequirement.trim()}` : '',
  ].filter(Boolean);

  const generation_requirement = reqParts.join('\n');

  return { novel_outline, current_context, generation_requirement };
}
