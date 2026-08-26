import { NavLink } from 'react-router-dom';
import { BarChart3, Lightbulb, GitBranch, BookOpen, Sun, Moon, PenTool, Loader2, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useState, useEffect, useMemo } from 'react';
import { useGeneration } from '@/contexts/GenerationContext';

const NAV_ITEMS = [
  { path: '/', label: '品类调研', icon: BarChart3 },
  { path: '/outline', label: '一句话大纲', icon: Lightbulb },
  { path: '/expansion', label: '大纲拓展', icon: GitBranch },
  { path: '/novel', label: '小说生成', icon: BookOpen },
];

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { tasks } = useGeneration();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const runningTasks = useMemo(() => tasks.filter((t) => t.status === 'running'), [tasks]);
  const hasRunning = runningTasks.length > 0;
  const primaryTask = runningTasks[0];
  const isPaused = primaryTask?.pauseStatus === 'paused';
  const isStopped = primaryTask?.pauseStatus === 'stopped';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-10">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <PenTool className="size-4" />
            </div>
            <span className="text-base font-semibold text-foreground">墨染 AI</span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`
                  }
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {hasRunning && primaryTask && (
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm md:flex">
              {isPaused ? (
                <Pause className="size-3.5 text-warning" />
              ) : isStopped ? (
                <Loader2 className="size-3.5 text-destructive" />
              ) : (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              )}
              <span className="font-medium text-foreground">
                {isPaused
                  ? `${primaryTask.label}（已暂停）`
                  : isStopped
                  ? `${primaryTask.label}（已停止）`
                  : `正在生成${primaryTask.label}`}
              </span>
              {primaryTask.progressText && (
                <span className="max-w-[180px] truncate">{primaryTask.progressText}</span>
              )}
            </div>
          )}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="切换主题"
              className="size-9"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* 移动端底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`
                }
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
