import { App, Notice } from 'obsidian';
import { log, warn } from './utils/logger';
import { ACTION_PREFIX } from './constants';
export { ACTION_PREFIX } from './constants';

export interface CortexAction {
  action: string;
  [key: string]: unknown;
}

/**
 * Scan accumulated text for complete @@CORTEX_ACTION lines.
 * Returns cleaned text (lines stripped) and parsed actions.
 */
export function extractActions(text: string): { clean: string; actions: CortexAction[] } {
  const actions: CortexAction[] = [];
  const lines = text.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    if (line.startsWith(ACTION_PREFIX)) {
      try {
        const action = JSON.parse(line.slice(ACTION_PREFIX.length)) as CortexAction;
        actions.push(action);
        log('UIBridge: parsed action:', action.action, action);
      } catch {
        warn('UIBridge: malformed action line:', line);
      }
    } else {
      kept.push(line);
    }
  }

  return { clean: kept.join('\n'), actions };
}

/**
 * Execute a single Cortex UI action via the Obsidian API.
 */
export async function executeAction(app: App, action: CortexAction): Promise<void> {
  log('UIBridge: executing action:', action.action);

  switch (action.action) {

    case 'open-file': {
      const file = app.vault.getFileByPath(action.path as string);
      if (file) {
        await app.workspace.getLeaf(false).openFile(file);
      } else {
        warn('UIBridge: open-file — file not found:', action.path);
      }
      break;
    }

    case 'open-file-split': {
      const file = app.vault.getFileByPath(action.path as string);
      if (file) {
        const direction = (action.direction as 'vertical' | 'horizontal') ?? 'vertical';
        const leaf = app.workspace.getLeaf('split');
        await leaf.openFile(file);
      } else {
        warn('UIBridge: open-file-split — file not found:', action.path);
      }
      break;
    }

    case 'navigate-heading': {
      const file = app.vault.getFileByPath(action.path as string);
      if (file) {
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        // Scroll to heading via the editor after a brief tick to allow render
        setTimeout(() => {
          const view = leaf.view as any;
          const editor = view?.editor;
          if (editor && action.heading) {
            const content = editor.getValue() as string;
            const lines = content.split('\n');
            const idx = lines.findIndex((l: string) =>
              l.replace(/^#+\s*/, '').toLowerCase() === (action.heading as string).toLowerCase()
            );
            if (idx !== -1) editor.setCursor({ line: idx, ch: 0 });
          }
        }, 100);
      } else {
        warn('UIBridge: navigate-heading — file not found:', action.path);
      }
      break;
    }

    case 'show-notice': {
      const msg = (action.message as string) ?? '';
      const duration = typeof action.duration === 'number' ? action.duration : 4000;
      new Notice(msg, duration);
      break;
    }

    case 'focus-search': {
      (app as any).commands.executeCommandById('switcher:open');
      break;
    }

    case 'open-settings': {
      const tab = action.tab as string | undefined;
      (app as any).setting.open();
      if (tab) (app as any).setting.openTabById(tab);
      break;
    }

    default:
      warn('UIBridge: unknown action:', action.action);
  }
}
