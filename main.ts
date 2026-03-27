import { Plugin, Notice, WorkspaceLeaf, addIcon } from 'obsidian';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ClaudeView, VIEW_TYPE_CLAUDE } from './src/ClaudeView';
import { CortexSettings, DEFAULT_SETTINGS, CortexSettingsTab } from './src/settings';
import { findClaudeBinary } from './src/ClaudeProcess';
import { resolveShellEnv } from './src/utils/shellEnv';
import { initLogger, log, warn } from './src/utils/logger';
import { AboutModal } from './src/modals/AboutModal';

export default class CortexPlugin extends Plugin {
  settings: CortexSettings;
  shellEnv: Record<string, string> = {};
  claudeBinaryPath: string | null = null;

  async onload() {
    await this.loadSettings();

    const vaultRoot = (this.app.vault.adapter as any).basePath;
    initLogger(vaultRoot, {
      enabled: this.settings.logEnabled,
      filePath: this.settings.logFilePath,
      verbosity: this.settings.logVerbosity,
    });
    log('Cortex loading — vault root:', vaultRoot);

    this.app.workspace.onLayoutReady(() => this.generateCommandsFile());

    this.shellEnv = resolveShellEnv();
    this.claudeBinaryPath = findClaudeBinary(this.settings.binaryPath);

    if (!this.claudeBinaryPath) {
      new Notice('Cortex: claude binary not found. Check plugin settings.');
    }

    // Register custom icon — three S-curves suggesting cortex folds (gyri).
    // Replace the path data here when the final logo SVG is ready.
    addIcon('cortex', `
      <path d="M10,32 C24,12 38,12 50,32 C62,52 76,52 90,32"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,50 C24,30 38,30 50,50 C62,70 76,70 90,50"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,68 C24,48 38,48 50,68 C62,88 76,88 90,68"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
    `);

    this.registerView(VIEW_TYPE_CLAUDE, (leaf) => new ClaudeView(leaf, this));

    this.addRibbonIcon('brain-circuit', 'Open Cortex agent', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-cortex-agent',
      name: 'Open agent panel',
      callback: () => {
        this.activateView();
      }
    });

    this.addCommand({
      id: 'open-cortex-settings',
      name: 'Open settings',
      callback: () => {
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById('cortex');
      }
    });

    this.addCommand({
      id: 'new-cortex-session',
      name: 'New session',
      callback: () => {
        this.newSession();
      }
    });

    this.addCommand({
      id: 'clear-cortex-session',
      name: 'Clear current session',
      callback: () => {
        this.clearCurrentSession();
      }
    });

    this.addCommand({
      id: 'toggle-cortex-panel',
      name: 'Toggle Cortex panel',
      callback: () => {
        this.togglePanel();
      }
    });

    this.addCommand({
      id: 'show-cortex-session-history',
      name: 'Show session history',
      callback: () => {
        this.showSessionHistory();
      }
    });

    this.addCommand({
      id: 'export-cortex-conversation',
      name: 'Export conversation',
      callback: () => {
        this.exportConversation();
      }
    });

    this.addCommand({
      id: 'copy-cortex-last-response',
      name: 'Copy last response',
      callback: () => {
        this.copyLastResponse();
      }
    });

    this.addCommand({
      id: 'send-selection-to-cortex',
      name: 'Send selection as context',
      editorCallback: (editor) => {
        const selection = editor.getSelection();
        if (!selection) {
          new Notice('No text selected');
          return;
        }
        const file = this.app.workspace.getActiveFile();
        const sourceName = file?.basename ?? 'note';
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (existing.length) {
          this.app.workspace.revealLeaf(existing[0]);
          (existing[0].view as ClaudeView).injectSelectionContext(selection, sourceName);
        } else {
          this.activateView().then(() => {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
            if (leaves.length) (leaves[0].view as ClaudeView).injectSelectionContext(selection, sourceName);
          });
        }
      }
    });

    this.addCommand({
      id: 'focus-cortex-input',
      name: 'Focus chat input',
      callback: () => {
        this.focusChatInput();
      }
    });

    this.addCommand({
      id: 'open-cortex-context-file',
      name: 'Open context file',
      callback: () => {
        this.openContextFile();
      }
    });

    this.addCommand({
      id: 'refresh-cortex-context',
      name: 'Refresh session context',
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (leaves.length) (leaves[0].view as ClaudeView).refreshSessionContext();
        else this.activateView().then(() => {
          const l = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
          if (l.length) (l[0].view as ClaudeView).refreshSessionContext();
        });
      }
    });

    this.addCommand({
      id: 'show-cortex-about',
      name: 'About Cortex',
      callback: () => {
        this.showAbout();
      }
    });

    this.addSettingTab(new CortexSettingsTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CLAUDE);
  }

  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);

    if (existing.length) {
      workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_CLAUDE, active: true });
      workspace.revealLeaf(leaf);
    }
  }

  newSession() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.startNewSession();
    } else {
      // If panel not open, open it and start new session
      this.activateView().then(() => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (existing.length) {
          const view = existing[0].view as ClaudeView;
          view.startNewSession();
        }
      });
    }
  }

  clearCurrentSession() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.clearCurrentSession();
    }
  }

  togglePanel() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      // Panel is open, detach it
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_CLAUDE);
    } else {
      // Panel is closed, open it
      this.activateView();
    }
  }

  showSessionHistory() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.showSessionHistory();
    } else {
      // If panel not open, open it first
      this.activateView().then(() => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (existing.length) {
          const view = existing[0].view as ClaudeView;
          view.showSessionHistory();
        }
      });
    }
  }

  exportConversation() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.exportConversation();
    }
  }

  copyLastResponse() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.copyLastResponse();
    }
  }

  focusChatInput() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      const view = existing[0].view as ClaudeView;
      view.focusInput();
    } else {
      this.activateView().then(() => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (leaves.length) (leaves[0].view as ClaudeView).focusInput();
      });
    }
  }

  openContextFile() {
    const contextPath = this.settings.contextFilePath || '_claude-context.md';
    const file = this.app.vault.getAbstractFileByPath(contextPath);
    if (file) {
      this.app.workspace.openLinkText(contextPath, '', false);
    } else {
      new Notice(`Context file not found: ${contextPath}`);
    }
  }

  showAbout() {
    new AboutModal(this.app, this).open();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Migrate old vault-root log path to plugin directory
    if (this.settings.logFilePath === '_cortex-debug.log') {
      this.settings.logFilePath = DEFAULT_SETTINGS.logFilePath;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  generateCommandsFile() {
    try {
      const vaultRoot = (this.app.vault.adapter as any).basePath;
      const outPath = join(vaultRoot, '.obsidian', 'plugins', 'cortex', 'commands.md');

      const commands = Object.values(
        (this.app as any).commands.commands as Record<string, { id: string; name: string }>
      ).sort((a, b) => a.id.localeCompare(b.id));

      // Group by plugin prefix (part before first ':')
      const groups = new Map<string, { id: string; name: string }[]>();
      for (const cmd of commands) {
        const prefix = cmd.id.includes(':') ? cmd.id.split(':')[0] : 'core';
        if (!groups.has(prefix)) groups.set(prefix, []);
        groups.get(prefix)!.push(cmd);
      }

      const lines: string[] = [
        '# Obsidian Command Reference',
        `_Generated: ${new Date().toISOString()}_`,
        '_Grep by plugin name or display name to find the right command ID for run-command._',
        '',
      ];

      for (const [prefix, cmds] of [...groups.entries()].sort()) {
        lines.push(`## ${prefix}`);
        for (const cmd of cmds) {
          lines.push(`- \`${cmd.id}\` — ${cmd.name}`);
        }
        lines.push('');
      }

      writeFileSync(outPath, lines.join('\n'), 'utf8');
      log(`Commands file written: ${outPath} (${commands.length} commands)`);
    } catch (e) {
      warn('Failed to write commands file:', e);
    }
  }

  notifyAllowlistChanged(newAllowlist: string[]) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) (leaves[0].view as ClaudeView).injectAllowlistUpdate(newAllowlist);
  }

  reconfigureLogger() {
    const vaultRoot = (this.app.vault.adapter as any).basePath;
    initLogger(vaultRoot, {
      enabled: this.settings.logEnabled,
      filePath: this.settings.logFilePath,
      verbosity: this.settings.logVerbosity,
    });
    log('Logger reconfigured — enabled:', this.settings.logEnabled, 'verbosity:', this.settings.logVerbosity);
  }
}
