import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import type { ICreationState, INITIAL_CREATION_STATE } from '@/data/novel';

const STATE_KEY = 'novel_creation_state';

export function loadCreationState(initial: typeof INITIAL_CREATION_STATE): typeof INITIAL_CREATION_STATE {
  try {
    const raw = scopedStorage.getItem(STATE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    return { ...initial, ...parsed };
  } catch {
    return initial;
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

// 主题持久化
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
