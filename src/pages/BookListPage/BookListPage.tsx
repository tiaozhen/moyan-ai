import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Tag,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { INovelArticle, NovelLengthType, ICategory, IStorySkeleton } from '@/data/novel';
import { NOVEL_LENGTH_OPTIONS } from '@/data/novel';
import {
  loadCreationState,
  saveCreationState,
  deleteArticle as deleteArticleFromState,
  setCurrentArticle,
} from '@/lib/storage';

export default function BookListPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<INovelArticle[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    const state = loadCreationState();
    setArticles(state.articles);
  }, []);

  const handleOpenBook = useCallback(
    (articleId: string) => {
      const state = loadCreationState();
      const next = setCurrentArticle(state, articleId);
      saveCreationState(next);
      navigate(`/books/${articleId}`);
    },
    [navigate]
  );

  const handleDelete = useCallback((articleId: string) => {
    setDeleteTargetId(articleId);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTargetId) return;
    const state = loadCreationState();
    const next = deleteArticleFromState(state, deleteTargetId);
    saveCreationState(next);
    setArticles(next.articles);
    toast.success('已删除小说');
    setDeleteTargetId(null);
  }, [deleteTargetId]);

  const deleteTarget = articles.find((a) => a.id === deleteTargetId);

  const getProgress = (article: INovelArticle) => {
    const total = article.chapters.length;
    if (total === 0) return { generated: 0, total: 0, percent: 0 };
    const generated = article.chapters.filter((c) => c.status !== 'unwritten').length;
    return { generated, total, percent: Math.round((generated / total) * 100) };
  };

  const lengthBadge = (t: NovelLengthType) => {
    const map: Record<NovelLengthType, string> = {
      short: '短篇',
      medium: '中篇',
      long: '长篇',
    };
    return map[t] || t;
  };

  // 生成带完整骨架的测试书（用于快速验证创作页）
  const handleCreateTestBook = useCallback(() => {
    const testCategory: ICategory = {
      id: 'test_cat_1',
      name: '都市异能',
      heatIndex: 85,
      competitionLevel: '高',
      competitionScore: 80,
      readerProfile: {
        ageDistribution: ['18-25岁', '26-35岁'],
        genderRatio: { malePercent: 60, femalePercent: 40 },
        interestTags: ['爽文', '逆袭', '异能'],
        readingPreferences: ['快节奏', '主角光环'],
      },
      growthTrend: {
        past3MonthsTrend: '上升',
        past3MonthsGrowthRate: 15,
        future3MonthsForecast: '持续增长',
        future3MonthsExpectedGrowthRate: 20,
        monthlyData: [
          { month: '3月前', value: 60 },
          { month: '2月前', value: 70 },
          { month: '上月', value: 85 },
        ],
      },
      dimensionScores: {
        marketPotential: 9,
        monetizationPotential: 8,
        creativeDifficulty: 6,
        readerStickiness: 8,
        developmentProspect: 9,
      },
      hotKeywords: ['异能', '都市', '逆袭', '爽文'],
      representativeWorks: [
        { workName: '都市最强维修工', author: '测试作者', popularity: '9.5' },
      ],
      developmentSuggestions: '建议突出主角能力成长曲线，搭配都市商战元素',
      description: '都市背景下的异能觉醒故事，主角从底层逆袭',
    };

    const testSkeleton: IStorySkeleton = {
      characterSettings: [
        { id: 'char_1', name: '林默', identity: '男主，普通维修工', personality: '沉稳内敛，重情义', coreDemand: '守护家人，证明自己', characterArc: '从自卑到自信，从独善其身到兼济天下' },
        { id: 'char_2', name: '苏晚晴', identity: '女主，企业高管', personality: '外冷内热，独立果决', coreDemand: '找到真正懂自己的人', characterArc: '从功利主义到相信真情' },
        { id: 'char_3', name: '王胖子', identity: '主角好友', personality: '幽默仗义，贪财好色', coreDemand: '跟着兄弟吃香喝辣', characterArc: '从贪小便宜到大义凛然' },
      ],
      worldView: {
        background: '现代都市，表面繁华下暗流涌动',
        rules: '异能者隐于市井，各有规矩',
        coreConflictEnvironment: '都市利益集团与异能者的矛盾',
      },
      plotNodes: [
        { id: 'plot_1', nodeName: '异能觉醒', nodeContent: '林默在一次维修事故中意外觉醒修复能力', importance: '高' },
        { id: 'plot_2', nodeName: '初试锋芒', nodeContent: '靠修复能力解决生活难题，逐渐引起注意', importance: '中' },
        { id: 'plot_3', nodeName: '势力登场', nodeContent: '各大势力开始关注林默，危机逼近', importance: '高' },
        { id: 'plot_4', nodeName: '情感升温', nodeContent: '林默与苏晚晴关系逐渐拉近', importance: '中' },
      ],
      narrativeStructure: {
        opening: '林默在底层挣扎，生活窘迫，意外获得异能',
        development: '依靠能力改变命运，结识女主，卷入更大风波',
        climax: '面对终极反派，能力与意志的双重考验',
        ending: '守护了重要的人，找到了人生方向',
      },
      chapterPlan: [
        { id: 'ch_1', chapterNumber: '第1章', chapterTitle: '落魄维修工', chapterSummary: '林默在修车行艰难维生，被客户羞辱', coreEvent: '主角登场，展示困境', characters: '林默、老板、客户', sceneLocation: '修车行', moodTone: '压抑', chapterStart: '清晨的修车行，林默蹲在地上拧螺丝', chapterEnd: '被客户当众羞辱后黯然离去', foreshadowing: '提到父亲留下的旧工具箱', phase: '铺垫' },
        { id: 'ch_2', chapterNumber: '第2章', chapterTitle: '奇迹的手', chapterSummary: '林默意外发现自己的手能修复一切', coreEvent: '异能觉醒', characters: '林默', sceneLocation: '出租屋', moodTone: '震惊', chapterStart: '回到破旧出租屋，林默翻出父亲留下的旧手表', chapterEnd: '他震惊地看着手中焕然一新的手表', foreshadowing: '修复时有温热感从胸口扩散', phase: '铺垫' },
        { id: 'ch_3', chapterNumber: '第3章', chapterTitle: '第一桶金', chapterSummary: '林默靠修复能力赚到第一笔钱', coreEvent: '初试异能获利', characters: '林默、手机店老板', sceneLocation: '电子市场', moodTone: '兴奋', chapterStart: '林默拿着碎屏手机来到电子市场', chapterEnd: '他握着刚赚到的钱，眼中有了光', foreshadowing: '手机店老板狐疑地打量他', phase: '发展' },
        { id: 'ch_4', chapterNumber: '第4章', chapterTitle: '偶遇佳人', chapterSummary: '林默帮苏晚晴修好珍贵项链', coreEvent: '男女主初遇', characters: '林默、苏晚晴', sceneLocation: '咖啡厅', moodTone: '温馨', chapterStart: '苏晚晴的项链在咖啡厅意外断裂', chapterEnd: '苏晚晴看着修好的项链若有所思', foreshadowing: '项链似乎有特殊来历', phase: '发展' },
        { id: 'ch_5', chapterNumber: '第5章', chapterTitle: '风波渐起', chapterSummary: '林默的异常引起地下势力注意', coreEvent: '危机初现', characters: '林默、神秘人', sceneLocation: '夜街', moodTone: '紧张', chapterStart: '林默夜归时发现被人跟踪', chapterEnd: '他在巷子里被神秘人拦下', foreshadowing: '神秘人提到"组织"', phase: '发展' },
      ],
    };

    const newArticle: INovelArticle = {
      id: `test_${Date.now()}`,
      title: '都市最强维修工',
      lengthType: 'medium',
      category: testCategory,
      outline: {
        id: 'test_outline_1',
        title: '都市最强维修工',
        concept: '一个普通维修工意外获得修复万物的能力，从修手机到修人生，在都市中走出一条逆袭之路',
        tags: ['都市', '异能', '逆袭'],
      },
      storySkeleton: testSkeleton,
      chapters: [],
      currentChapterId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const state = loadCreationState();
    const next = {
      ...state,
      articles: [newArticle, ...state.articles],
      currentArticleId: newArticle.id,
      selectedCategory: testCategory,
      selectedOutline: newArticle.outline,
    };
    saveCreationState(next);
    setArticles(next.articles);
    toast.success('测试数据已生成，点击卡片进入详情验证创作页');
  }, []);

  const sortedArticles = [...articles].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      {/* 顶部 */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">我的书架</h1>
          <p className="mt-2 text-muted-foreground">
            管理你的所有小说作品，点击进入详情继续创作
          </p>
        </div>
        <Button
          onClick={() => navigate('/outline')}
          className="gap-2"
        >
          <Plus className="size-4" />
          创建新小说
        </Button>
      </div>

      {/* 空状态 */}
      {articles.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">还没有小说作品</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            去一句话大纲页面，选一个打动你的故事点子，开始你的第一部小说吧
          </p>
          <Button className="mt-4 gap-2" onClick={() => navigate('/outline')}>
            <Lightbulb className="size-4" />
            去生成大纲
          </Button>
          <div className="mt-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCreateTestBook}>
              <BookOpen className="size-3.5" />
              生成测试数据（快速验证）
            </Button>
          </div>
        </div>
      )}

      {/* 小说列表 */}
      {sortedArticles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedArticles.map((article) => {
            const progress = getProgress(article);
            return (
              <Card
                key={article.id}
                className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => handleOpenBook(article.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-lg">{article.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(article.id);
                      }}
                      aria-label="删除"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {article.outline?.concept || '暂无一句话大纲'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {lengthBadge(article.lengthType)}
                    </Badge>
                    {article.category && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Tag className="size-3" />
                        {article.category.name}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>创作进度</span>
                      <span>
                        {progress.generated}/{progress.total} 章 · {progress.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {format(article.createdAt, 'yyyy-MM-dd')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {format(article.updatedAt, 'MM-dd HH:mm')}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              确认删除小说
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除《{deleteTarget?.title}》吗？删除后所有故事骨架、章节内容都将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
