import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, Users, Zap, BarChart3, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { loadCreationState, saveCreationState } from '@/lib/storage';
import { useGeneration } from '@/contexts/GenerationContext';
import type { ICategory, ICategoryResearchData } from '@/data/novel';
import { CHART_COLORS, CHART_PRIMARY, CHART_SECONDARY } from '@/lib/chart-colors';

const CATEGORY_DIRECTIONS = ['玄幻', '都市', '言情', '科幻', '悬疑', '历史'];

export default function CategoryResearchPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ICategoryResearchData | null>(null);
  const [keyword, setKeyword] = useState('');
  const { startCategoryResearch, isTaskRunning, tasks } = useGeneration();
  const loading = isTaskRunning('category_research');

  // 页面加载时从本地存储恢复数据
  useEffect(() => {
    const state = loadCreationState();
    if (state.categoryResearchData) {
      setData(state.categoryResearchData);
    }
  }, []);

  // 如果后台正在生成，轮询 storage 同步展示最新进度数据
  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      const state = loadCreationState();
      if (state.categoryResearchData && state.categoryResearchData.categories.length > 0) {
        setData(state.categoryResearchData);
      }
    }, 800);
    return () => window.clearInterval(timer);
  }, [loading]);

  // 生成完成后读一次最终数据
  useEffect(() => {
    if (tasks.some((t) => t.type === 'category_research' && t.status === 'done')) {
      const state = loadCreationState();
      if (state.categoryResearchData) {
        setData(state.categoryResearchData);
      }
    }
  }, [tasks]);

  const generateResearch = useCallback(async () => {
    const result = await startCategoryResearch(CATEGORY_DIRECTIONS, mapApiToCategory);
    if (result) {
      setData(result);
    }
  }, [startCategoryResearch]);

  const handleSelectCategory = useCallback(
    (category: ICategory) => {
      const state = loadCreationState();
      saveCreationState({ ...state, selectedCategory: category });
      toast.success(`已选择「${category.name}」品类`);
      navigate('/outline');
    },
    [navigate]
  );

  const filteredCategories = data?.categories.filter(
    (c) =>
      !keyword ||
      c.name.includes(keyword) ||
      c.hotKeywords.some((k) => k.includes(keyword))
  );

  // 柱状图 option
  const barOption: EChartsOption | null = data
    ? {
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0, type: 'scroll' },
        grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.categories.map((c) => c.name),
          axisLabel: { interval: 0 },
        },
        yAxis: { type: 'value', max: 100 },
        series: [
          {
            name: '热度指数',
            type: 'bar',
            data: data.categories.map((c) => c.heatIndex),
            itemStyle: { color: CHART_PRIMARY, borderRadius: [4, 4, 0, 0] },
            barWidth: '30%',
          },
          {
            name: '竞争评分',
            type: 'bar',
            data: data.categories.map((c) => c.competitionScore * 10),
            itemStyle: { color: CHART_SECONDARY, borderRadius: [4, 4, 0, 0] },
            barWidth: '30%',
          },
        ],
      }
    : null;

  // 雷达图 option（取第一个品类）
  const radarOption: EChartsOption | null =
    data && data.categories.length > 0
      ? {
          tooltip: {},
          legend: { bottom: 0, type: 'scroll' },
          radar: {
            indicator: [
              { name: '市场潜力' },
              { name: '变现潜力' },
              { name: '创作难度' },
              { name: '读者粘性' },
              { name: '发展前景' },
            ],
            center: ['50%', '45%'],
            radius: '60%',
          },
          series: [
            {
              type: 'radar',
              data: data.categories.slice(0, 5).map((c, i) => ({
                name: c.name,
                value: [
                  c.dimensionScores.marketPotential,
                  c.dimensionScores.monetizationPotential,
                  c.dimensionScores.creativeDifficulty,
                  c.dimensionScores.readerStickiness,
                  c.dimensionScores.developmentProspect,
                ],
                lineStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
                itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
                areaStyle: { opacity: 0.1 },
              })),
            },
          ],
        }
      : null;

  // 折线图 option
  const lineOption: EChartsOption | null =
    data && data.categories.length > 0
      ? {
          tooltip: { trigger: 'axis' },
          legend: { bottom: 0, type: 'scroll' },
          grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: data.categories[0].growthTrend.monthlyData.map((m) => m.month),
          },
          yAxis: { type: 'value' },
          series: data.categories.slice(0, 5).map((c, i) => ({
            name: c.name,
            type: 'line',
            data: c.growthTrend.monthlyData.map((m) => m.value),
            smooth: true,
            lineStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
          })),
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* 顶部 Hero 区 */}
      <section className="mb-10 flex flex-col items-start justify-between gap-6 md:mb-12 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <BarChart3 className="size-3" />
              第一步
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">品类市场调研</h1>
          <p className="mt-2 text-muted-foreground">
            AI 分析各小说品类的市场热度、竞争格局与增长潜力，帮你找到最适合的创作赛道
          </p>
        </div>
        <Button onClick={generateResearch} disabled={loading} size="lg" className="gap-2">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              AI 分析中...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              AI 生成调研
            </>
          )}
        </Button>
      </section>

      {/* 空状态 */}
      {!data && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center"
        >
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">开始你的创作之旅</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            点击上方「AI 生成调研」按钮，系统将自动分析多个主流小说品类的市场数据，
            为你提供全面的品类选择参考
          </p>
        </motion.div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="rounded-xl border border-border bg-card/30 p-16 text-center">
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">AI 正在深度分析各品类市场数据，请稍候...</p>
        </div>
      )}

      {/* 数据展示 */}
      <AnimatePresence mode="wait">
        {data && !loading && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* 搜索框 */}
            <div className="relative max-w-sm">
              <Input
                type="search"
                placeholder="搜索品类或关键词"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
              />
              <svg
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* KPI 概览卡 */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard
                icon={<TrendingUp className="size-4" />}
                label="最热品类"
                value={data.categories.reduce((a, b) => (a.heatIndex > b.heatIndex ? a : b)).name}
                sub={`热度 ${data.categories.reduce((a, b) => (a.heatIndex > b.heatIndex ? a : b)).heatIndex}`}
              />
              <KpiCard
                icon={<Zap className="size-4" />}
                label="增长最快"
                value={data.categories.reduce((a, b) =>
                  a.growthTrend.past3MonthsGrowthRate > b.growthTrend.past3MonthsGrowthRate ? a : b
                ).name}
                sub={`+${data.categories.reduce((a, b) =>
                  a.growthTrend.past3MonthsGrowthRate > b.growthTrend.past3MonthsGrowthRate
                    ? a
                    : b
                ).growthTrend.past3MonthsGrowthRate.toFixed(1)}%`}
              />
              <KpiCard
                icon={<Users className="size-4" />}
                label="读者最多"
                value={data.categories.reduce((a, b) =>
                  a.dimensionScores.readerStickiness > b.dimensionScores.readerStickiness ? a : b
                ).name}
                sub={`粘性 ${data.categories.reduce((a, b) =>
                  a.dimensionScores.readerStickiness > b.dimensionScores.readerStickiness
                    ? a
                    : b
                ).dimensionScores.readerStickiness.toFixed(1)} 分`}
              />
              <KpiCard
                icon={<CheckCircle2 className="size-4" />}
                label="蓝海品类"
                value={data.categories.reduce((a, b) =>
                  a.competitionScore < b.competitionScore ? a : b
                ).name}
                sub={`竞争 ${data.categories.reduce((a, b) =>
                  a.competitionScore < b.competitionScore ? a : b
                ).competitionScore.toFixed(1)} 分`}
              />
            </div>

            {/* 图表区 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">品类热度与竞争对比</CardTitle>
                  <CardDescription>各品类热度指数与竞争烈度评分对比</CardDescription>
                </CardHeader>
                <CardContent>
                  {barOption && (
                    <ReactECharts option={barOption} theme="ud" className="h-[300px] w-full" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">多维度能力雷达</CardTitle>
                  <CardDescription>TOP5 品类在五大维度的综合表现</CardDescription>
                </CardHeader>
                <CardContent>
                  {radarOption && (
                    <ReactECharts option={radarOption} theme="ud" className="h-[300px] w-full" />
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">增长趋势曲线</CardTitle>
                  <CardDescription>近 6 个月各品类热度指数变化趋势</CardDescription>
                </CardHeader>
                <CardContent>
                  {lineOption && (
                    <ReactECharts option={lineOption} theme="ud" className="h-[320px] w-full" />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 数据表格 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">品类详细数据</CardTitle>
                <CardDescription>各品类的核心指标一览</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">品类</TableHead>
                        <TableHead className="whitespace-nowrap">热度指数</TableHead>
                        <TableHead className="whitespace-nowrap">竞争烈度</TableHead>
                        <TableHead className="whitespace-nowrap">近3月增长</TableHead>
                        <TableHead className="whitespace-nowrap">变现潜力</TableHead>
                        <TableHead className="whitespace-nowrap">热门标签</TableHead>
                        <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories?.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="tabular-nums">{c.heatIndex}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                c.competitionScore >= 7
                                  ? 'destructive'
                                  : c.competitionScore >= 5
                                    ? 'secondary'
                                    : 'default'
                              }
                            >
                              {c.competitionLevel}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`tabular-nums ${c.growthTrend.past3MonthsGrowthRate >= 0 ? 'text-success' : 'text-destructive'}`}
                          >
                            {c.growthTrend.past3MonthsGrowthRate >= 0 ? '+' : ''}
                            {c.growthTrend.past3MonthsGrowthRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {c.dimensionScores.monetizationPotential.toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-[200px] flex-wrap gap-1">
                              {c.hotKeywords.slice(0, 3).map((k) => (
                                <Badge key={k} variant="outline" className="text-xs">
                                  {k}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSelectCategory(c)}
                              className="gap-1"
                            >
                              选择此品类
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* 品类卡片网格 */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">品类详情卡片</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCategories?.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  >
                    <Card className="h-full">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{c.name}</CardTitle>
                          <Badge
                            variant={
                              c.growthTrend.past3MonthsGrowthRate >= 0 ? 'default' : 'secondary'
                            }
                          >
                            {c.growthTrend.past3MonthsGrowthRate >= 0 ? '↑' : '↓'}{' '}
                            {Math.abs(c.growthTrend.past3MonthsGrowthRate).toFixed(1)}%
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground">热度指数</div>
                            <div className="text-2xl font-semibold tabular-nums">{c.heatIndex}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">竞争评分</div>
                            <div className="text-2xl font-semibold tabular-nums">
                              {c.competitionScore.toFixed(1)}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">热门关键词</div>
                          <div className="flex flex-wrap gap-1">
                            {c.hotKeywords.slice(0, 4).map((k) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">读者画像</div>
                          <div className="text-xs text-foreground">
                            男女比例 {c.readerProfile.genderRatio.malePercent} :{' '}
                            {c.readerProfile.genderRatio.femalePercent}
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          variant="default"
                          onClick={() => handleSelectCategory(c)}
                        >
                          选择此品类
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// 将 API 返回数据映射为 ICategory
function mapApiToCategory(apiData: any): ICategory {
  const name = apiData.category_name || '未知品类';
  const dim = apiData.dimension_scores || {};
  const gt = apiData.growth_trend || {};
  const rp = apiData.reader_profile || {};

  // 构造月度趋势数据（基于增长率生成模拟）
  const growthRate = gt.past_3_months_growth_rate || 5;
  const baseValue = (apiData.heat_index || 60) * 0.7;
  const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
  const monthlyData = months.map((m, i) => ({
    month: m,
    value: Math.round(baseValue * (1 + (growthRate / 100) * i)),
  }));

  return {
    id: `cat-${name}`,
    name,
    heatIndex: apiData.heat_index || 60,
    competitionLevel: apiData.competition_level || '中',
    competitionScore: apiData.competition_score || 5,
    readerProfile: {
      ageDistribution: rp.age_distribution || ['18-24岁', '25-30岁', '31-40岁'],
      genderRatio: {
        malePercent: rp.gender_ratio?.male_percent || 50,
        femalePercent: rp.gender_ratio?.female_percent || 50,
      },
      interestTags: rp.interest_tags || ['爽文', '升级', '逆袭'],
      readingPreferences: rp.reading_preferences || ['碎片化阅读', '睡前阅读'],
    },
    growthTrend: {
      past3MonthsTrend: gt.past_3_months_trend || '上升',
      past3MonthsGrowthRate: gt.past_3_months_growth_rate || 5,
      future3MonthsForecast: gt.future_3_months_forecast || '平稳',
      future3MonthsExpectedGrowthRate: gt.future_3_months_expected_growth_rate || 3,
      monthlyData,
    },
    dimensionScores: {
      marketPotential: dim.market_potential || 7,
      monetizationPotential: dim.monetization_potential || 7,
      creativeDifficulty: dim.creative_difficulty || 5,
      readerStickiness: dim.reader_stickiness || 7,
      developmentProspect: dim.development_prospect || 7,
    },
    hotKeywords: apiData.hot_keywords || [],
    representativeWorks:
      apiData.representative_works?.map((w: any) => ({
        workName: w.work_name,
        author: w.author,
        popularity: w.popularity,
      })) || [],
    developmentSuggestions: apiData.development_suggestions || '',
    description: apiData.development_suggestions
      ? `该品类${apiData.competition_level || '中等'}竞争，${gt.past_3_months_trend || '平稳'}增长。${apiData.development_suggestions.slice(0, 50)}...`
      : '热门小说品类，拥有广泛的读者基础和良好的发展前景。',
  };
}
