# AI 小说创作全流程辅助平台 - 需求拆解文档

## 产品概述

- **产品类型**: AI 驱动的 Web 应用（创作工具平台）
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 网络小说作者、内容创作者、编剧、写作爱好者
- **核心价值**: 全流程 AI 自动化辅助小说创作，从品类调研、大纲生成到骨架搭建与正文撰写，用户仅在关键节点做选择和微调，大幅降低创作门槛与周期
- **界面语言**: 中文（zh-CN）
- **主题偏好**: user_specified（支持浅色/深色主题切换，整体温润中性色调，避免冷科技蓝）
- **导航模式**: 路径导航
- **导航布局**: Topbar（顶部导航栏，消费者/创作者前台风格）

---

## 页面结构总览

> **说明**：四个一级页面对应用户明确要求的顶部导航菜单，流程为线性递进（品类调研 → 一句话大纲 → 大纲拓展 → 小说生成）

| 页面名称 | 文件名 | 路由 | 页面类型 | 入口来源 |
|---------|-------|------|---------|---------|
| 品类调研数据 | `CategoryResearchPage.tsx` | `/` | 一级 | 导航 |
| 一句话大纲 | `OutlinePage.tsx` | `/outline` | 一级 | 导航 / 品类调研页 → 点击"选择此品类" |
| 大纲拓展 | `OutlineExpansionPage.tsx` | `/expansion` | 一级 | 导航 / 一句话大纲页 → 点击"选择此大纲" |
| 小说生成详情 | `NovelGeneratorPage.tsx` | `/novel` | 一级 | 导航 / 大纲拓展页 → 点击"确认骨架，开始创作" |

---

## 页面布局建议

### 品类调研数据页
- **布局模式**: 上下分区 + 卡片网格 + 数据仪表区
- **视觉重心**: 数据可视化图表区与品类卡片区
- **结果承载区**: 图表区（柱状图/雷达图/折线图）+ 品类数据表格 + 品类卡片网格；初始态为空状态提示 + "AI生成调研"按钮

### 一句话大纲页
- **布局模式**: 卡片网格布局
- **视觉重心**: 大纲卡片网格
- **结果承载区**: 大纲卡片网格（每张含标题、一句话故事、标签、选择按钮）；初始态为空状态 + 当前已选品类信息 + "AI生成大纲"按钮

### 大纲拓展页
- **布局模式**: 左右分栏（左侧大纲结构导航 + 右侧编辑区）
- **视觉重心**: 故事骨架编辑区
- **结果承载区**: 人物设定卡、世界观设定、主线剧情节点、起承转合结构、章节规划五大模块，全部可编辑；初始态为空状态 + "AI生成骨架"按钮

### 小说生成详情页
- **布局模式**: 三栏布局（左侧章节列表 + 中间富文本编辑器 + 右侧 AI 助手面板）
- **视觉重心**: 中间编辑区（Notion 风格）
- **结果承载区**: 编辑器正文区（含 AI 内联补全灰色幽灵文字）；左侧章节列表支持切换；右侧 AI 助手提供续写/润色/扩写操作

---

## 插件规划

| 插件实例名称 | 基于官方插件 | 业务用途 | 输出模式 | 所属页面 |
|------------|-----------|---------|---------|---------|
| 品类调研生成 | ai-text-to-json | 根据用户输入/默认配置生成小说品类市场调研结构化数据（热度、竞争、读者画像、增长趋势等） | unary | 品类调研数据页 |
| 一句话大纲生成 | ai-text-generate | 基于选定品类批量生成多个高概念一句话故事大纲 | stream | 一句话大纲页 |
| 大纲骨架生成 | ai-text-to-json | 基于选定的一句话大纲生成完整故事骨架（人物、世界观、剧情节点、章节规划等结构化内容） | unary | 大纲拓展页 |
| 小说正文生成 | ai-text-generate | 基于大纲上下文生成/续写/扩写章节正文，流式输出 | stream | 小说生成详情页 |
| 小说润色优化 | ai-text-generate | 对选中的正文段落进行润色优化，流式输出润色结果 | stream | 小说生成详情页 |

---

## 导航配置

- **导航布局**: Topbar（顶部固定，极简风格）
- **导航项**（4 个一级页面对应 4 个菜单项）:

| 导航文字 | 路由 | 图标(可选) |
|---------|------|-----------|
| 品类调研 | `/` | BarChart3 |
| 一句话大纲 | `/outline` | Lightbulb |
| 大纲拓展 | `/expansion` | GitBranch |
| 小说生成 | `/novel` | BookOpen |

> **补充说明**：顶部导航栏右侧放置主题切换按钮（浅色/深色）。导航项高亮当前页，按流程顺序排列，体现创作递进关系。

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 品类调研数据生成 | real-plugin | 调用 ai-text-to-json 实例，传入创作方向/市场参数，输出结构化的品类调研数据（含热度指数、竞争烈度、读者画像、增长趋势等字段） | 失败提示（toast "AI 调研生成失败，请重试"） |
| 一句话大纲生成 | real-plugin | 调用 ai-text-generate 实例，传入选定品类，流式输出多个一句话大纲卡片内容 | 失败提示（toast "大纲生成失败，请重试"） |
| 故事骨架生成 | real-plugin | 调用 ai-text-to-json 实例，传入选定的一句话大纲，输出结构化故事骨架（人物、世界观、剧情、章节规划） | 失败提示（toast "骨架生成失败，请重试"） |
| 小说正文续写/扩写 | real-plugin | 调用 ai-text-generate 实例，传入当前章节上下文 + 大纲约束 + 操作类型，流式输出续写/扩写文本，以内联方式插入编辑器 | 失败提示（toast "AI 生成失败，请重试"） |
| 小说润色 | real-plugin | 调用 ai-text-generate 实例，传入选中的正文段落 + 润色要求，流式输出润色后的文本 | 失败提示（toast "润色失败，请重试"） |
| 用户选品/选大纲/骨架编辑状态 | local-persist | localStorage key=`__global_novel_creation_state`，保存当前选定的品类、一句话大纲、拓展后的骨架、章节内容等创作进度 | 无（首次进入为空） |
| 章节正文内容 | local-persist | localStorage key=`__global_novel_chapters`，保存所有章节的正文内容与编辑状态 | 无 |
| 主题偏好 | local-persist | localStorage key=`__global_novel_theme`，保存用户选择的浅色/深色主题 | 默认浅色主题 |

> 说明：所有 AI 生成类功能均为 real-plugin 类型，插件不可 mock，失败时仅展示 toast 提示，不提供降级假数据。

---

## 功能列表

### 品类调研数据页

- **页面目标**: 通过 AI 生成小说各品类市场调研数据，辅助用户选择创作品类
- **功能点**:
  - **AI 生成调研数据**: 点击"AI生成调研"按钮触发插件调用，生成后展示品类热度指数柱状图、竞争与读者画像雷达图、增长趋势折线图，以及品类数据表格
  - **品类卡片展示与选择**: 每个品类以卡片形式呈现核心指标（热度、竞争、增长、读者画像标签），点击"选择此品类"后保存选定品类并跳转至一句话大纲页
  - **数据多维可视化**: 提供柱状图（品类热度对比）、雷达图（多维度评估）、折线图（增长趋势）三种图表视图，支持 hover 查看详情
  - **品类数据表格**: 以表格形式列出所有品类的详细指标数据，支持排序查看

### 一句话大纲页

- **页面目标**: 基于选定品类，AI 批量生成高概念一句话大纲，用户选择中意的故事点子
- **功能点**:
  - **展示当前选定品类**: 页面顶部显示已选品类名称与简介，可返回重新选择
  - **AI 批量生成大纲**: 点击"AI生成大纲"按钮触发插件流式调用，生成多张大纲卡片，每张包含标题、一句话核心故事、标签
  - **大纲卡片网格展示**: 以响应式卡片网格布局展示所有生成的大纲，支持悬停微动效
  - **选择大纲进入下一步**: 每张卡片底部有"选择此大纲"按钮，点击后保存选定大纲并跳转至大纲拓展页

### 大纲拓展页

- **页面目标**: 将一句话大纲拓展为完整故事骨架，用户可编辑微调各部分内容
- **功能点**:
  - **AI 生成故事骨架**: 点击"AI生成骨架"按钮，基于选定的一句话大纲生成人物设定、世界观设定、主线剧情节点、起承转合结构、章节规划五大模块
  - **分模块可编辑**: 每个模块（人物卡、世界观、剧情节点、起承转合、章节规划）均支持直接编辑修改，文本区提供基础排版
  - **左侧结构导航**: 左侧固定大纲结构目录，点击快速跳转到对应模块
  - **确认骨架进入创作**: 底部"确认骨架，开始创作"按钮，保存最终骨架并跳转至小说生成详情页

### 小说生成详情页

- **页面目标**: 提供 Notion 风格的富文本编辑环境，结合 AI 助手完成小说正文创作
- **功能点**:
  - **左侧章节列表**: 展示从骨架导入的所有章节，支持点击切换当前编辑章节，章节状态区分（未生成/已生成/已编辑）
  - **Notion 风格富文本编辑器**: 中间编辑区，支持干净的悬浮工具栏（加粗、斜体、标题、列表等），支持 Markdown 快捷键，行高与留白舒适
  - **内联 AI 补全（幽灵文字）**: AI 生成的续写/扩写内容以灰色幽灵文字形式内联显示在光标处，用户按 Tab 接受，继续输入则取消
  - **右侧 AI 助手面板**: 提供"续写""润色""扩写"三个核心操作按钮，续写基于光标位置之后生成，润色/扩写基于选中的文本
  - **流式输出体验**: AI 生成内容逐字流式呈现，配合打字机动效，生成过程中可取消

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__global_novel_selectedCategory` | 当前选定的小说品类，类型 `ICategory` | 品类调研页、一句话大纲页 |
| `__global_novel_selectedOutline` | 当前选定的一句话大纲，类型 `IOutlineCard` | 一句话大纲页、大纲拓展页 |
| `__global_novel_storySkeleton` | 拓展后的完整故事骨架，类型 `IStorySkeleton` | 大纲拓展页、小说生成详情页 |
| `__global_novel_chapters` | 所有章节的正文内容与状态，类型 `IChapter[]` | 小说生成详情页 |
| `__global_novel_currentChapterId` | 当前编辑的章节 ID，类型 `string` | 小说生成详情页 |

```ts
// 品类调研数据项
interface ICategory {
  id: string;
  name: string;
  heatIndex: number;        // 热度指数
  competitionLevel: number; // 竞争烈度 1-10
  readerProfile: {
    ageRange: string;
    genderRatio: string;
    tags: string[];
  };
  growthTrend: { date: string; value: number }[]; // 增长趋势数据点
  multiDimScores: {         // 雷达图多维度评分
    creativity: number;
    readerBase: number;
    monetization: number;
    competition: number;
    growth: number;
  };
  description: string;
}

// 一句话大纲卡片
interface IOutlineCard {
  id: string;
  title: string;
  concept: string; // 一句话核心故事
  tags: string[];
}

// 故事骨架
interface IStorySkeleton {
  characters: ICharacter[];      // 人物设定卡
  worldSetting: IWorldSetting;   // 世界观设定
  mainPlotNodes: IPlotNode[];    // 主线剧情节点
  structure: IStructure;         // 起承转合结构
  chapterPlan: IChapterMeta[];   // 章节规划
}

interface ICharacter {
  id: string;
  name: string;
  role: string;      // 主角/配角/反派等
  description: string;
  personality: string;
  background: string;
}

interface IWorldSetting {
  era: string;
  background: string;
  powerSystem?: string;
  rules: string;
}

interface IPlotNode {
  id: string;
  phase: string;
  description: string;
  keyEvents: string[];
}

interface IStructure {
  opening: string;   // 起
  development: string; // 承
  climax: string;    // 转
  ending: string;    // 合
}

// 章节元信息（骨架规划阶段）
interface IChapterMeta {
  id: string;
  index: number;
  title: string;
  summary: string;
}

// 章节完整数据（含正文，创作阶段）
interface IChapter extends IChapterMeta {
  content: string;
  status: 'unwritten' | 'generated' | 'edited';
  lastModified: number;
}

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Mood Reference —— 从 shadcn/ui 的极简组件、Novel 的 Notion 编辑器、Ant Design Pro 的数据布局中提取气质与结构感，不照搬品牌色或具体组件样式
- **核心情绪 / 应用类型**: 温润克制的创作工作台，让数据驱动决策、让 AI 服务创作，用户在关键节点做选择而非被工具消耗
- **独特记忆点**: 墨色暖纸的创作质感 + AI 幽灵文字内联补全，数据页冷静有序，创作页温暖沉浸，用同一套温润中性色系统贯穿全流程

## 2. Art Direction

- **方向名**: 暖墨工作台
- **Design Style**: Swiss Minimalist 瑞士极简 + Warm Editorial 暖调编辑感 —— 数据页需要秩序与清晰度，创作页需要阅读舒适度与沉浸感，温润中性底统一两种场景
- **DNA 参数**: 圆角 soft（`rounded-lg` / `rounded-xl`）/ 阴影 subtle（`shadow-sm`，悬停 `shadow-md`）/ 间距 spacious（`gap-6` / `p-8`）/ 字体方向：正文无衬线清晰、标题微衬线气质 / 装饰手法：细描边分隔、纸张质感背景、极少量暖赭色作为主交互锚点
- **应用类型**: Workflow —— 四步线性流程 + 顶部导航锚定当前步骤，数据页信息密度高，创作页三栏沉浸布局

## 3. Color System

**色彩关系**: 暖赭石主色 + 米白纸张背景 + 墨灰文字 + 同色系浅赭 accent 底，整体偏暖不偏冷
**配色设计理由**: primary 用低饱和暖赭石，只承担 CTA、当前步骤高亮与品牌锚点，不抢夺数据与文字阅读；bg 用米白模拟纸张质感，契合小说创作的书写语境；text 用墨灰而非纯黑，长文阅读更舒适；accent 与 border 均从暖灰系衍生，保持温润统一
**主色推导**: 从"小说创作 / 书写 / 墨迹与纸"的语义出发，避开冰冷科技蓝，选用暖赭石（类似旧书脊、墨水瓶标签的颜色），既有创作的人文温度，又足够克制可作为工具产品主色
**使用比例**: 65% 中性（bg + card + 文本灰阶）/ 25% 辅助（accent 浅底 + border）/ 10% primary（暖赭石，仅用于主按钮、当前页高亮、关键状态）

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(30 20% 98%) | 米白纸张色页面背景 |
| card | `--card` | `bg-card` | hsl(0 0% 100%) | 纯白卡片承载面，与 bg 微差拉开层次 |
| text | `--foreground` | `text-foreground` | hsl(20 10% 15%) | 墨灰正文，暖调不刺眼 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(20 6% 45%) | 辅助文字、占位符、说明 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(24 60% 45%) | 暖赭石主色，CTA 与激活态 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(30 30% 98%) | 主色上的米白文字 |
| accent | `--accent` | `bg-accent` | hsl(30 25% 94%) | hover / focus / 选中浅底，暖灰调 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(20 10% 25%) | accent 上的深灰文字 |
| border | `--border` | `border-border` | hsl(30 12% 88%) | 暖灰边框，柔和不突兀 |

**语义色提示**: 成功 hsl(142 35% 40%) + bg hsl(142 40% 95%) + border hsl(142 30% 85%)；警告 hsl(38 70% 50%) + bg hsl(45 70% 95%) + border hsl(40 50% 85%)；错误 hsl(0 55% 50%) + bg hsl(0 50% 96%) + border hsl(0 40% 88%)；所有语义色饱和度与 primary 对齐（±15%），避免状态色刺眼盖过主色；图表色从暖赭石、橄榄绿、灰蓝、琥珀、紫红五个低饱和色中选取，均保持 35-50% 饱和度区间

## 4. 字体与节奏

- **font-display**: Noto Serif SC —— 标题、品类名、大纲标题使用，微衬线带来文学感与创作气质
- **font-body**: Noto Sans SC —— 正文、数据、UI 控件使用，清晰易读，长文不疲劳
- **字号**: H1 text-4xl ~ text-5xl；H2 text-2xl；H3 text-lg；body text-base（创作编辑器正文 text-lg，行宽优化）；muted text-sm
- **圆角**: 大 —— 卡片 `rounded-xl`、按钮 `rounded-lg`、输入框 `rounded-md`，柔和无锐角，呼应温润调性

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导；数据页借鉴 Ant Design Pro 的卡片+图表+表格三段式，创作页借鉴 Novel 的左章中编右助三栏式
- **Page / Section Order**: 四个顶部导航页按创作流程线性排列：品类调研 → 一句话大纲 → 大纲拓展 → 小说生成；当前页以 primary 色高亮
- **Standard Content Zone**: 数据页 `max-w-6xl mx-auto`；创作页三栏全宽布局 `max-w-[1400px] mx-auto`
- **Shell / Frame Alignment**: 顶部导航与内容区同宽对齐，导航 `max-w-6xl` 居中，创作页三栏独立于导航宽度约束
- **Padding & Rhythm**: `px-4 md:px-6 lg:px-8 py-8 md:py-12`，区块间距 `gap-8`，卡片间距 `gap-6`
- **Full-bleed Zones**: 创作编辑器页面背景可全宽，三栏内容受 `max-w-[1400px]` 约束
- **Local Narrowing**: 大纲拓展页的表单与编辑区可收窄至 `max-w-3xl` 居中，保证阅读行长
- **Overflow Strategy**: 数据表格、雷达图容器、章节列表使用 `overflow-x-auto` / `overflow-y-auto`，不突破布局框架
- **Flexibility Boundary**: 允许移动端卡片列数、编辑器三栏折叠为单栏、padding 微调；不允许改变主色、圆角系统、字体栈和步骤导航逻辑

## 6. 视觉与动效

- **装饰**: 细线分隔、微纸张纹理背景、暖赭石主按钮
- **阴影/边界**: 轻 —— 默认 `shadow-sm`，hover `shadow-md` + 边框微加深，无重阴影
- **动效**: 精致克制 —— 按钮 hover 背景色过渡 150ms；卡片 hover 微上浮 + 阴影加深 200ms；AI 生成内容淡入 300ms；幽灵文字补全以低透明度渐显；页面切换无整屏动效

## 7. 组件原则

- 按钮、输入、卡片、菜单项必须具备 Default / Hover / Active / Focus-visible / Disabled 五态
- Primary 按钮仅用于每步的核心行动（AI生成、选择此品类、确认骨架开始创作），其余操作用 Outline / Ghost
- 数据卡片用 `bg-card` + `border border-border` + `rounded-xl` + `shadow-sm`，悬停时 `shadow-md` 与边框微暖
- 编辑器悬浮工具栏：`bg-card/95` + `backdrop-blur-sm` + `border border-border` + `rounded-lg` + `shadow-md`，紧贴选区上方
- AI 幽灵补全文字：`text-muted-foreground` 透明度 50%，内联显示在光标后，Tab 键接受
- 空状态与加载态延续暖纸 + 墨灰 + 赭石的视觉语言，不用默认蓝紫骨架屏

## 8. Image Direction

- **Image Role**: 无强制图片需求，优先通过排版、色彩和微纸张质感建立视觉记忆点
- **Image Art Direction**: 无强制图片需求
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 避免通用科技感 AI 大脑插图、商务人物素材图、无意义渐变背景图

## 9. Anti-patterns

- **冷蓝漂移**: 回到默认科技蓝按钮和冷灰背景；坚守暖赭石 + 米白纸的创作语境
- **主色泛滥**: 把 primary 同时用在按钮、tab、icon、边框、链接、图表上；严格按 10% 比例，primary 只给 CTA 与当前步骤
- **两副面孔**: 数据页用冷科技风、创作页用文艺风，视觉系统断裂；用同一套色板、圆角、字体贯穿，只通过密度与布局区分场景
- **幽灵文字无反馈**: AI 补全只有灰色文字没有接受/拒绝机制；必须有 Tab 接受、Esc 取消的明确交互与视觉状态
- **编辑器过重**: 工具栏堆满图标、侧边栏信息过载；遵循 Novel 极简原则，悬浮工具栏只保留最常用 5-6 个操作
- **状态色刺眼**: 成功/警告/错误用高饱和纯色；语义色饱和度与 primary 对齐，保持温润统一