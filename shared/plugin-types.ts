// ---- plugin:novel_content_generate_1 ----
// ============================================================
// 插件 novel_content_generate_1 (小说正文生成/续写/扩写助手) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface NovelContentGenerateOneInput {
  /** 生成/续写/扩写的具体要求，如篇幅长度、情节走向、风格调整等 */
  generation_requirement?: string;
  /** 小说整体大纲或当前章节设定要求 */
  novel_outline: string;
  /** 当前章节已有的上下文内容 */
  current_context: string;
}

/**
 * capabilityClient.load('novel_content_generate_1').callStream<NovelContentGenerateOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 NovelContentGenerateOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface NovelContentGenerateOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:novel_content_generate_1 ----

// ---- plugin:novel_content_polishing_1 ----
// ============================================================
// 插件 novel_content_polishing_1 (小说正文润色优化) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface NovelContentPolishingOneInput {
  /** 待润色的小说正文段落 */
  novel_paragraph: string;
}

/**
 * capabilityClient.load('novel_content_polishing_1').callStream<NovelContentPolishingOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 NovelContentPolishingOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface NovelContentPolishingOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:novel_content_polishing_1 ----

// ---- plugin:batch_generate_short_novel_outline_1 ----
// ============================================================
// 插件 batch_generate_short_novel_outline_1 (批量生成一句话小说大纲) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface BatchGenerateShortNovelOutlineOneInput {
  /** 其他特殊要求（如：偏向脑洞反转、包含情感转折等） */
  additional_requirements?: string;
  /** 小说品类（如：科幻、悬疑、言情、玄幻、都市等） */
  category: string;
  /** 需要生成的大纲数量（如：10个、20个） */
  count: string;
}

/**
 * capabilityClient.load('batch_generate_short_novel_outline_1').callStream<BatchGenerateShortNovelOutlineOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 BatchGenerateShortNovelOutlineOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"response":"示例文本","content":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.response ?? ''; }
 */
export interface BatchGenerateShortNovelOutlineOneOutput {
  /** [object Object] */
  response?: string;
  /** [object Object] */
  content: string;
}
// ---- end:batch_generate_short_novel_outline_1 ----

// ---- plugin:novel_category_market_research_1 ----
// ============================================================
// 插件 novel_category_market_research_1 (小说品类市场调研数据生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface NovelCategoryMarketResearchOneInput {
  /** 小说品类方向，如：玄幻、都市、言情、科幻、悬疑等 */
  category_direction: string;
}

/**
 * capabilityClient.load('novel_category_market_research_1').call<NovelCategoryMarketResearchOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { competition_score, growth_trend, hot_keywords, ... } = result;
 * 返回值形如：
 *   {"competition_score":0,"growth_trend":{},"hot_keywords":[],"representative_works":[],"development_suggestions":"示例文本","category_name":"示例文本","competition_level":"示例文本","reader_profile":{},"dimension_scores":{},"heat_index":0}
 */
export interface NovelCategoryMarketResearchOneOutput {
  /** 竞争烈度评分（1-10分，分数越高竞争越激烈） */
  competition_score: number;
  /** 增长趋势信息，schema: {past_3_months_trend: String(近3个月趋势：上升/平稳/下降), past_3_months_growth_rate: Number(近3个月增长率百分比), future_3_months_forecast: String(未来3个月预测：上升/平稳/下降), future_3_months_expected_growth_rate: Number(未来3个月预期增长率百分比)} */
  growth_trend: Record<string, unknown>;
  /** 品类热门关键词列表 */
  hot_keywords: unknown[];
  /** 代表作品列表，items schema: {work_name: String(作品名称), author: String(作者名称), popularity: String(人气情况)} */
  representative_works: unknown[];
  /** 品类发展建议 */
  development_suggestions: string;
  /** 小说品类名称 */
  category_name: string;
  /** 竞争烈度等级，可选值：低、中低、中、中高、高 */
  competition_level: string;
  /** 读者画像信息，schema: {age_distribution: Array(年龄分布列表), gender_ratio: Object(性别占比，包含male_percent和female_percent字段), interest_tags: Array(兴趣标签列表), reading_preferences: Array(阅读偏好列表)} */
  reader_profile: Record<string, unknown>;
  /** 多维度评分（1-10分），schema: {market_potential: Number(市场潜力评分), monetization_potential: Number(变现潜力评分), creative_difficulty: Number(创作难度评分), reader_stickiness: Number(读者粘性评分), development_prospect: Number(发展前景评分)} */
  dimension_scores: Record<string, unknown>;
  /** 品类热度指数（0-100） */
  heat_index: number;
}
// ---- end:novel_category_market_research_1 ----

// ---- plugin:story_outline_generator_1 ----
// ============================================================
// 插件 story_outline_generator_1 (故事骨架生成器) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface StoryOutlineGeneratorOneInput {
  /** 故事的一句话核心大纲 */
  story_outline: string;
}

/**
 * capabilityClient.load('story_outline_generator_1').call<StoryOutlineGeneratorOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { character_settings, world_view, plot_nodes, ... } = result;
 * 返回值形如：
 *   {"character_settings":[],"world_view":{},"plot_nodes":[],"narrative_structure":{},"chapter_plan":[]}
 */
export interface StoryOutlineGeneratorOneOutput {
  /** 主要人物设定列表，items schema: {name: string(人物姓名), identity: string(身份背景), personality: string(性格特点), core_demand: string(核心诉求), character_arc: string(人物成长弧光)} */
  character_settings: unknown[];
  /** 世界观设定，schema: {background: string(时代/世界背景), rules: string(世界运行规则), core_conflict_environment: string(核心冲突环境)} */
  world_view: Record<string, unknown>;
  /** 核心剧情节点列表，items schema: {node_name: string(节点名称), node_content: string(节点内容), importance: string(重要程度：高/中/低)} */
  plot_nodes: unknown[];
  /** 起承转合结构，schema: {opening: string(开端：故事背景与人物引入), development: string(发展：冲突升级与事件展开), climax: string(高潮：核心冲突爆发与关键抉择), ending: string(结局：冲突解决与故事收尾)} */
  narrative_structure: Record<string, unknown>;
  /** 章节规划列表，items schema: {chapter_number: string(章节序号), chapter_title: string(章节标题), chapter_summary: string(章节概要), core_event: string(核心事件)} */
  chapter_plan: unknown[];
}
// ---- end:story_outline_generator_1 ----