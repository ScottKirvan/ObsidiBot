import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, setIcon, TFile, Modal, App } from 'obsidian';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type CortexPlugin from '../main';
import { spawnClaude, parseStreamOutput, killProcess, findClaudeBinary, PermissionDenial, PermissionMode } from './ClaudeProcess';
import { extractActions, executeAction } from './UIBridge';
import { VaultQuery, VaultQueryResult, resolveQuery, queryLabel, buildInjectMessage } from './QueryHandler';
import { QUERY_PREFIX } from './constants';
import { ContextManager } from './ContextManager';
import { log, estimateTokens } from './utils/logger';
import { extractToolDetail } from './utils/toolFormatting';
import {
  StoredSession,
  saveSession,
  saveSessionAtTop,
  loadAllSessions,
  titleFromPrompt,
  canResumeLocally,
  loadSessionMessages,
} from './utils/sessionStorage';
import { SessionListModal } from './modals/SessionListModal';
import { ExportToVaultModal } from './modals/ExportToVaultModal';
import { ContextGenerationModal } from './ContextGenerationModal';
import { AboutModal } from './modals/AboutModal';

export const VIEW_TYPE_CLAUDE = 'cortex-chat';

// Maps from lowercase tool name to display values.
// Claude Code sends PascalCase names (Read, Write, Bash…) so we normalise to lowercase for lookup.
const TOOL_STATUS: Record<string, string> = {
  read: 'Reading…',
  write: 'Writing…',
  edit: 'Editing…',
  multiedit: 'Editing…',
  bash: 'Running command…',
  glob: 'Scanning vault…',
  grep: 'Searching…',
  ls: 'Listing…',
  webfetch: 'Fetching…',
  websearch: 'Searching the web…',
  todowrite: 'Updating tasks…',
  todoread: 'Reading tasks…',
};

const TOOL_ICONS: Record<string, string> = {
  read: 'file-text',
  write: 'file-edit',
  edit: 'file-edit',
  multiedit: 'file-edit',
  bash: 'terminal',
  glob: 'folder',
  grep: 'search',
  ls: 'folder',
  webfetch: 'globe',
  websearch: 'globe',
  todowrite: 'check-square',
  todoread: 'check-square',
};



export class ClaudeView extends ItemView {
  plugin: CortexPlugin;
  private inputEl: HTMLTextAreaElement;
  private messagesEl: HTMLElement;
  private sendBtn: HTMLButtonElement;
  private sessionStatusEl: HTMLElement;
  private currentSessionId: string | undefined;      // Claude's session ID (used for --resume)
  private currentSessionFileId: string | undefined;  // JSON file id (may differ from claudeSessionId)
  private currentSessionTitle: string | undefined;
  private currentSessionCreatedAt: string | undefined;
  private placeholderSessionId: string | undefined;
  private inputHistory: string[] = [];
  private historyIndex: number = -1;
  private inputDraft: string = '';
  private activeProc: ReturnType<typeof spawnClaude> | null = null;
  private pendingContexts: Array<{ text: string; source: string; pinned: boolean; type?: 'text' | 'url' | 'image' | 'pdf' }> = [];
  private pendingContextZone: HTMLElement;
  /** Overrides settings.permissionMode for the current session only. Cleared on new session. */
  private sessionPermissionOverride: PermissionMode | null = null;
  /** Pending system message to prepend to the next continuing-session turn (allowlist update, context refresh, etc.). */
  private pendingSystemMessage: string | null = null;
  private atDropdownEl: HTMLElement;
  private atDropdownItems: TFile[] = [];
  private tokenGaugeEl: SVGElement;
  private attachPopoverEl: HTMLElement;
  private sessionContextTokens = 0;
  static readonly CONTEXT_WINDOW = 200_000;
  private atDropdownIndex = -1;

  constructor(leaf: WorkspaceLeaf, plugin: CortexPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_CLAUDE; }
  getDisplayText(): string { return 'Cortex'; }
  getIcon(): string { return 'cortex'; }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('cortex-view');

    const toolbar = root.createDiv({ cls: 'cortex-toolbar' });
    this.sessionStatusEl = toolbar.createSpan({ cls: 'cortex-session-status', text: 'New session' });
    this.sessionStatusEl.addEventListener('click', () => this.showSessionHistory());
    this.sessionStatusEl.title = 'Click to see session history';

    const newSessionBtn = toolbar.createEl('button', { cls: 'cortex-icon-btn' });
    setIcon(newSessionBtn, 'message-square-plus');
    newSessionBtn.title = 'New session';
    newSessionBtn.addEventListener('click', () => this.startNewSession());

    // Spacer pushes help/settings to the right
    toolbar.createDiv({ cls: 'cortex-toolbar-spacer' });

    const toolbarRight = toolbar.createDiv({ cls: 'cortex-toolbar-right' });

    const helpBtn = toolbarRight.createEl('button', { cls: 'cortex-icon-btn' });
    setIcon(helpBtn, 'circle-help');
    helpBtn.title = 'About Cortex';
    helpBtn.addEventListener('click', () => {
      new AboutModal(this.app, this.plugin).open();
    });

    const settingsBtn = toolbarRight.createEl('button', { cls: 'cortex-icon-btn' });
    //setIcon(settingsBtn, 'settings');
    setIcon(settingsBtn, 'brain-cog');
    settingsBtn.title = 'Open Cortex settings';
    settingsBtn.addEventListener('click', () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById('cortex');
    });

    this.messagesEl = root.createDiv({ cls: 'cortex-messages' });

    const inputArea = root.createDiv({ cls: 'cortex-input-area' });

    this.atDropdownEl = inputArea.createDiv({ cls: 'cortex-at-dropdown' });
    this.atDropdownEl.style.display = 'none';

    this.attachPopoverEl = inputArea.createDiv({ cls: 'cortex-attach-popover' });
    this.attachPopoverEl.style.display = 'none';
    const attachFileBtn = this.attachPopoverEl.createEl('button', { cls: 'cortex-attach-option', text: '📄  Attach file' });
    attachFileBtn.addEventListener('mousedown', (e) => { e.preventDefault(); this.closeAttachPopover(); this.openFilePicker(); });
    const attachUrlBtn = this.attachPopoverEl.createEl('button', { cls: 'cortex-attach-option', text: '🔗  URL' });
    attachUrlBtn.addEventListener('mousedown', (e) => { e.preventDefault(); this.closeAttachPopover(); new AttachUrlModal(this.app, (url) => this.attachUrl(url)).open(); });
    const attachAtBtn = this.attachPopoverEl.createEl('button', { cls: 'cortex-attach-option', text: '@ Add note' });
    attachAtBtn.addEventListener('mousedown', (e) => {
      e.preventDefault(); this.closeAttachPopover();
      this.inputEl.focus();
      const pos = this.inputEl.selectionStart ?? this.inputEl.value.length;
      this.inputEl.setRangeText('@', pos, pos, 'end');
      this.inputEl.dispatchEvent(new Event('input'));
    });

    this.pendingContextZone = inputArea.createDiv({ cls: 'cortex-pending-context' });
    this.pendingContextZone.style.display = 'none';

    this.inputEl = inputArea.createEl('textarea', {
      cls: 'cortex-input',
      attr: { placeholder: 'Ask Cortex…', rows: '3' },
    });

    const inputToolbar = inputArea.createDiv({ cls: 'cortex-input-toolbar' });

    const attachBtn = inputToolbar.createEl('button', { cls: 'cortex-icon-btn cortex-input-toolbar-btn' });
    setIcon(attachBtn, 'paperclip');
    attachBtn.title = 'Attach file or URL';
    attachBtn.addEventListener('click', () => this.toggleAttachPopover(attachBtn));

    const slashBtn = inputToolbar.createEl('button', { cls: 'cortex-icon-btn cortex-input-toolbar-btn' });
    setIcon(slashBtn, 'slash');
    slashBtn.title = 'Slash commands (coming soon)';
    slashBtn.disabled = true;

    inputToolbar.createDiv({ cls: 'cortex-input-toolbar-spacer' });

    // Token gauge — SVG ring showing context window usage
    const NS = 'http://www.w3.org/2000/svg';
    const R = 7, C = R * 2 * Math.PI;
    const svg = document.createElementNS(NS, 'svg') as SVGElement;
    svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.classList.add('cortex-token-gauge');
    const svgTitle = document.createElementNS(NS, 'title');
    svg.appendChild(svgTitle);
    const track = document.createElementNS(NS, 'circle');
    track.setAttribute('cx', '9'); track.setAttribute('cy', '9'); track.setAttribute('r', String(R));
    track.classList.add('cortex-gauge-track');
    const arc = document.createElementNS(NS, 'circle');
    arc.setAttribute('cx', '9'); arc.setAttribute('cy', '9'); arc.setAttribute('r', String(R));
    arc.classList.add('cortex-gauge-arc');
    arc.setAttribute('stroke-dasharray', String(C));
    arc.setAttribute('stroke-dashoffset', String(C));
    svg.appendChild(track); svg.appendChild(arc);
    svg.addEventListener('click', () => this.compactSession());
    svg.style.display = 'none';
    inputToolbar.appendChild(svg);
    this.tokenGaugeEl = svg;

    this.sendBtn = inputToolbar.createEl('button', { cls: 'cortex-icon-btn cortex-send' });
    setIcon(this.sendBtn, 'arrow-up');
    this.sendBtn.title = 'Send message';

    this.sendBtn.addEventListener('click', () => {
      if (this.sendBtn.dataset.state === 'running') {
        if (this.activeProc) killProcess(this.activeProc);
      } else {
        this.handleSend();
      }
    });
    this.inputEl.addEventListener('input', () => this.handleAtMention());

    this.inputEl.addEventListener('blur', () => {
      // Delay so mousedown on a dropdown item fires before the dropdown hides
      setTimeout(() => this.atDropdownHide(), 150);
    });

    this.inputEl.addEventListener('keydown', (e) => {
      // Dropdown navigation takes priority over everything else
      if (this.atDropdownEl.style.display !== 'none') {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.atDropdownNav(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); this.atDropdownNav(-1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.atDropdownSelect(); return; }
        if (e.key === 'Escape') { this.atDropdownHide(); return; }
      }

      if (e.key === 'Enter' && !e.shiftKey && this.plugin.settings.sendOnEnter) {
        e.preventDefault();
        this.handleSend();
        return;
      }

      if (e.key === 'ArrowUp' && !e.shiftKey) {
        const { selectionStart, value } = this.inputEl;
        const onFirstLine = !value.substring(0, selectionStart).includes('\n');
        if (onFirstLine && this.inputHistory.length > 0) {
          e.preventDefault();
          if (this.historyIndex === -1) this.inputDraft = value;
          const next = Math.min(this.historyIndex + 1, this.inputHistory.length - 1);
          this.historyIndex = next;
          this.inputEl.value = this.inputHistory[this.inputHistory.length - 1 - next];
          this.inputEl.setSelectionRange(0, 0);
        }
        return;
      }

      if (e.key === 'ArrowDown' && !e.shiftKey) {
        if (this.historyIndex === -1) return;
        e.preventDefault();
        const { value } = this.inputEl;
        const onLastLine = !value.substring(this.inputEl.selectionEnd).includes('\n');
        if (!onLastLine) return;
        if (this.historyIndex === 0) {
          this.historyIndex = -1;
          this.inputEl.value = this.inputDraft;
        } else {
          this.historyIndex -= 1;
          this.inputEl.value = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
        }
        const len = this.inputEl.value.length;
        this.inputEl.setSelectionRange(len, len);
      }
    });

    this.inputEl.addEventListener('paste', (e: ClipboardEvent) => {
      void this.handlePaste(e);
    });

    root.addEventListener('dragover', (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      root.classList.add('cortex-drag-over');
    });
    root.addEventListener('dragleave', (e: DragEvent) => {
      // Only clear highlight when leaving the panel entirely (relatedTarget is outside root)
      if (!root.contains(e.relatedTarget as Node)) root.classList.remove('cortex-drag-over');
    });
    root.addEventListener('drop', (e: DragEvent) => {
      root.classList.remove('cortex-drag-over');
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      void this.handleDroppedFiles(e.dataTransfer.files);
    });

    // If Claude binary is missing, show setup guide and stop here
    if (!this.plugin.claudeBinaryPath) {
      this.renderSetupPanel();
      return;
    }

    if (this.plugin.settings.resumeLastSession) {
      const vaultRoot = (this.app.vault.adapter as any).basePath;
      const sessions = loadAllSessions(vaultRoot);
      if (sessions.length > 0) {
        const lastId = this.plugin.settings.lastActiveSessionId;
        const target = (lastId && sessions.find(s => s.id === lastId)) || sessions[0];
        try {
          await this.loadSession(target);
        } catch (e) {
          log('Failed to load session, starting new:', e);
          this.startNewSession();
        }
      }
    }

    // Show context file setup modal if the configured file doesn't exist and user hasn't skipped
    if (
      !this.plugin.settings.skipContextFilePrompt &&
      !this.app.vault.getFileByPath(this.plugin.settings.contextFilePath)
    ) {
      const vaultRoot = (this.app.vault.adapter as any).basePath;
      new ContextGenerationModal(
        this.app,
        this.plugin,
        this.plugin.settings.contextFilePath,
        this.plugin.claudeBinaryPath,
        vaultRoot,
        this.plugin.shellEnv,
        this.plugin.settings.vaultTreeDepth,
      ).open();
    }
  }

  async onClose() { /* nothing to clean up yet */ }

  startNewSession() {
    this.sessionPermissionOverride = null;
    this.sessionContextTokens = 0;
    this.tokenGaugeEl.style.display = 'none';
    this.pendingContexts = [];
    this.renderContextZone();
    const vaultRoot = (this.app.vault.adapter as any).basePath;
    const now = new Date().toISOString();
    const sessionId = now.replace(/[:.]/g, '-');

    const newSession: StoredSession = {
      id: sessionId,
      title: 'Untitled session',
      createdAt: now,
      updatedAt: now,
      claudeSessionId: '',
    };

    saveSessionAtTop(vaultRoot, newSession);
    this.placeholderSessionId = sessionId;
    this.currentSessionId = undefined;
    this.currentSessionFileId = sessionId;
    this.currentSessionTitle = 'Untitled session';
    this.currentSessionCreatedAt = now;
    this.messagesEl.empty();
    this.updateSessionStatus();
    log('New session placeholder created:', sessionId);
  }

  showSessionHistory() {
    const vaultRoot = (this.app.vault.adapter as any).basePath;
    const sessions = loadAllSessions(vaultRoot);
    new SessionListModal(this.app, vaultRoot, sessions, (session) => {
      this.loadSession(session);
    }, () => {
      this.startNewSession();
    }, () => {
      this.inputEl?.focus();
    }, this.currentSessionFileId, (session) => {
      if (session.id === this.currentSessionFileId) {
        this.currentSessionTitle = session.title;
        this.updateSessionStatus();
      }
    }, (session) => {
      void this.exportSessionToVault(session);
    }).open();
  }

  /** Build export markdown from DOM messages (active session). */
  private buildExportMarkdown(title: string, sessionId: string, userLabel: string, assistantLabel: string): string {
    const msgEls = Array.from(
      this.messagesEl.querySelectorAll('.cortex-message.cortex-user, .cortex-message.cortex-assistant')
    ) as HTMLElement[];
    const date = new Date().toISOString().slice(0, 10);
    let md = `---\ncortex_session: true\ndate: ${date}\nsession_id: ${sessionId}\nmessages: ${msgEls.length}\n---\n\n`;
    md += `# ${title}\n\n`;
    for (const el of msgEls) {
      const label = el.classList.contains('cortex-user') ? userLabel : assistantLabel;
      const content = (el.dataset.markdown ?? el.textContent ?? '').trim();
      md += `**${label}:**\n${content}\n\n`;
    }
    return md;
  }

  /** Shared vault-write logic used by both active and history exports. */
  private async writeExportNote(notePath: string, content: string): Promise<void> {
    if (!notePath.endsWith('.md')) notePath += '.md';
    const folder = notePath.includes('/') ? notePath.split('/').slice(0, -1).join('/') : '';
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const existing = this.app.vault.getAbstractFileByPath(notePath);
    if (existing) {
      await this.app.vault.modify(existing as TFile, content);
    } else {
      await this.app.vault.create(notePath, content);
    }
    new Notice(`Saved to ${notePath}`, 4000);
    log('Session exported to vault:', notePath);
  }

  /** Export the currently visible session to a vault note. */
  async exportToVault(): Promise<void> {
    const messages = this.messagesEl.querySelectorAll('.cortex-message');
    if (messages.length === 0) { new Notice('No conversation to export'); return; }
    const title = this.currentSessionTitle || 'Cortex Session';
    const sessionId = this.currentSessionId ?? '';
    const date = new Date().toISOString().slice(0, 10);
    const safeName = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    const folder = this.plugin.settings.exportFolder.trim();
    const defaultPath = folder ? `${folder}/${safeName} ${date}.md` : `${safeName} ${date}.md`;
    new ExportToVaultModal(this.app, defaultPath, async (notePath) => {
      const notice = new Notice('Preparing transcript…', 0);
      const { userLabel, assistantLabel } = await this.queryConversationLabels();
      notice.hide();
      const content = this.buildExportMarkdown(title, sessionId, userLabel, assistantLabel);
      await this.writeExportNote(notePath, content);
    }).open();
  }

  /** Export any session (by StoredSession) from the history modal. */
  private async exportSessionToVault(session: StoredSession): Promise<void> {
    const messages = loadSessionMessages(session.claudeSessionId);
    if (messages.length === 0) { new Notice('No messages found for this session'); return; }
    const date = new Date(session.updatedAt).toISOString().slice(0, 10);
    const safeName = session.title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    const folder = this.plugin.settings.exportFolder.trim();
    const defaultPath = folder ? `${folder}/${safeName} ${date}.md` : `${safeName} ${date}.md`;
    new ExportToVaultModal(this.app, defaultPath, async (notePath) => {
      const dateStr = new Date(session.updatedAt).toISOString().slice(0, 10);
      let md = `---\ncortex_session: true\ndate: ${dateStr}\nsession_id: ${session.claudeSessionId}\nmessages: ${messages.length}\n---\n\n`;
      md += `# ${session.title}\n\n`;
      for (const msg of messages) {
        const label = msg.role === 'user' ? (session.userLabel ?? 'User') : (session.assistantLabel ?? 'Cortex');
        md += `**${label}:**\n${msg.content.trim()}\n\n`;
      }
      await this.writeExportNote(notePath, md);
    }).open();
  }

  clearCurrentSession() {
    this.messagesEl.empty();
    this.appendMessage('system', 'Session cleared');
    this.updateSessionStatus();
    log('Current session cleared');
  }

  exportConversation() {
    const messages = this.messagesEl.querySelectorAll('.cortex-message');
    if (messages.length === 0) {
      new Notice('No conversation to export');
      return;
    }

    let markdown = `# Cortex Conversation\n`;
    if (this.currentSessionTitle) {
      markdown += `**Session:** ${this.currentSessionTitle}\n\n`;
    }

    messages.forEach((msgEl) => {
      const role = msgEl.classList.contains('cortex-user') ? 'User' :
        msgEl.classList.contains('cortex-assistant') ? 'Cortex' : 'System';
      // Use stored raw markdown for assistant messages; textContent for others
      const content = (msgEl as HTMLElement).dataset.markdown ?? msgEl.textContent ?? '';
      markdown += `## ${role}\n\n${content}\n\n`;
    });

    navigator.clipboard.writeText(markdown).then(() => {
      new Notice('Conversation exported to clipboard');
    }).catch(() => {
      new Notice('Failed to copy to clipboard');
    });

    log('Conversation exported to clipboard');
  }

  copyLastResponse() {
    const messages = this.messagesEl.querySelectorAll('.cortex-message.cortex-assistant');
    if (messages.length === 0) {
      new Notice('No assistant responses found');
      return;
    }

    const lastResponse = messages[messages.length - 1] as HTMLElement;
    // Use stored raw markdown; fall back to textContent
    const content = lastResponse.dataset.markdown ?? lastResponse.textContent ?? '';

    navigator.clipboard.writeText(content).then(() => {
      new Notice('Last response copied to clipboard');
    }).catch(() => {
      new Notice('Failed to copy to clipboard');
    });

    log('Last response copied to clipboard');
  }

  focusInput() {
    this.inputEl?.focus();
  }

  private bridgeOptions() {
    return {
      commandAllowlist: this.plugin.settings.commandAllowlist,
      commandDenylist: this.plugin.settings.commandDenylist,
      confirmUnlistedCommands: this.plugin.settings.confirmUnlistedCommands,
      onAddToAllowlist: async (commandId: string) => {
        if (!this.plugin.settings.commandAllowlist.includes(commandId)) {
          this.plugin.settings.commandAllowlist = [...this.plugin.settings.commandAllowlist, commandId];
          await this.plugin.saveSettings();
        }
      },
      onAddToDenylist: async (commandId: string) => {
        if (!this.plugin.settings.commandDenylist.includes(commandId)) {
          this.plugin.settings.commandDenylist = [...this.plugin.settings.commandDenylist, commandId];
          await this.plugin.saveSettings();
        }
      },
    };
  }

  injectSelectionContext(selection: string, sourceName: string) {
    this.pendingContexts.push({ text: selection, source: sourceName, pinned: false });
    this.renderContextZone();
    this.inputEl.focus();
  }

  injectAllowlistUpdate(newAllowlist: string[]) {
    if (newAllowlist.length === 0) {
      this.pendingSystemMessage =
        '[System: The command allowlist was updated — it is now empty. You can still use run-command for any command; the user will be prompted to approve or deny each attempt.]';
    } else {
      const rows = newAllowlist
        .map(id => {
          const name = (this.app as any).commands.commands[id]?.name ?? id;
          return `| "${name}" | ${id} |`;
        })
        .join('\n');
      this.pendingSystemMessage =
        `[System: The command allowlist was updated mid-session. These commands now execute immediately via run-command:\n${rows}\nAny other command will prompt the user for approval — do not assume unlisted commands are blocked.]`;
    }
  }

  async refreshSessionContext() {
    if (!this.currentSessionId) {
      this.appendMessage('system', 'No active session to refresh — context will be fully injected with your first message.');
      return;
    }

    const ctx = new ContextManager(
      this.app,
      this.plugin.settings.contextFilePath,
      this.plugin.settings.autonomousMemory,
      this.plugin.settings.vaultTreeDepth,
      this.plugin.settings.commandAllowlist,
    );
    const context = await ctx.buildSessionContext();
    this.pendingSystemMessage = `[System: Session context refreshed at user request.]\n\n${context}`;
    this.appendMessage('system', 'Context refresh queued — will be sent with your next message.');
  }

  /** Ask Claude to identify the human and AI names from the visible conversation. */
  private queryConversationLabels(): Promise<{ userLabel: string; assistantLabel: string }> {
    const defaults = { userLabel: 'User', assistantLabel: 'Cortex' };
    if (!this.plugin.claudeBinaryPath) return Promise.resolve(defaults);

    const msgEls = Array.from(
      this.messagesEl.querySelectorAll('.cortex-message.cortex-user, .cortex-message.cortex-assistant')
    ) as HTMLElement[];
    if (msgEls.length === 0) return Promise.resolve(defaults);

    // Walk all messages, truncating each, until we hit a total character budget.
    // This ensures a name change anywhere in the conversation is included.
    const BUDGET = 4000;
    const lines: string[] = [];
    let used = 0;
    for (const el of msgEls) {
      const role = el.classList.contains('cortex-user') ? 'Human' : 'AI';
      const content = (el.dataset.markdown ?? el.textContent ?? '').trim().substring(0, 400);
      const line = `${role}: ${content}`;
      if (used + line.length > BUDGET) break;
      lines.push(line);
      used += line.length;
    }
    const sample = lines.join('\n\n');

    const prompt =
      `What are the real names (if any) used for the human and the AI in this conversation?\n` +
      `Respond with exactly two lines — substitute the actual names from the conversation:\n` +
      `user: Sally\n` +
      `assistant: Banana\n` +
      `If the human has no name use "User"; if the AI has no name use "Cortex". No other text.\n\n` +
      sample;

    return new Promise((resolve) => {
      try {
        const proc = spawnClaude({
          binaryPath: this.plugin.claudeBinaryPath!,
          prompt,
          vaultRoot: (this.app.vault.adapter as any).basePath,
          env: this.plugin.shellEnv,
          permissionMode: 'readonly',
        });

        let responseText = '';
        parseStreamOutput(proc, {
          onText: (delta) => { responseText += delta; },
          onAction: () => {},
          onToolCall: () => {},
          onPermissionDenied: () => {},
          onUsage: () => {},
          onError: () => {},
          onDone: () => {
            const userMatch = /^user:\s*(.+)$/mi.exec(responseText);
            const assistantMatch = /^assistant:\s*(.+)$/mi.exec(responseText);
            resolve({
              userLabel: userMatch?.[1]?.trim() ?? 'User',
              assistantLabel: assistantMatch?.[1]?.trim() ?? 'Cortex',
            });
          },
        });

        proc.on('error', () => resolve(defaults));
      } catch {
        resolve(defaults);
      }
    });
  }

  private async loadSession(session: StoredSession) {
    this.placeholderSessionId = undefined;
    this.currentSessionId = session.claudeSessionId || undefined;
    this.currentSessionFileId = session.id;
    this.currentSessionTitle = session.title;
    this.currentSessionCreatedAt = session.createdAt;
    this.messagesEl.empty();
    this.updateSessionStatus();

    this.plugin.settings.lastActiveSessionId = session.id;
    void this.plugin.saveSettings();

    const isNew = !session.claudeSessionId;
    const resumable = !isNew && canResumeLocally(session.claudeSessionId);

    if (isNew) {
      this.placeholderSessionId = session.id;
    }

    if (resumable) {
      const messages = loadSessionMessages(session.claudeSessionId);
      if (messages.length > 0) {
        for (const msg of messages) {
          if (msg.role === 'user') {
            this.appendMessage('user', msg.content);
          } else {
            const el = this.appendMessage('assistant', '');
            el.dataset.markdown = msg.content;
            await MarkdownRenderer.render(this.app, msg.content, el, '', this);
          }
        }
        const divider = this.messagesEl.createDiv({ cls: 'cortex-history-divider' });
        divider.setText('─── resuming here ───');
        divider.scrollIntoView({ behavior: 'instant' });
      } else {
        this.appendMessage('system', `Resumed: ${session.title}`);
      }
    } else if (isNew) {
      this.appendMessage('system', `New session: ${session.title}`);
    } else {
      this.appendMessage('system', `Session from another machine: ${session.title}`);
    }

    log('Loaded session:', session.claudeSessionId || '(new)', session.title, resumable ? '(local)' : isNew ? '(new)' : '(remote)');
  }

  private updateSessionStatus() {
    if (this.currentSessionTitle) {
      this.sessionStatusEl.setText(this.currentSessionTitle);
      this.sessionStatusEl.title = this.currentSessionId ?? '';
    } else if (this.currentSessionId) {
      this.sessionStatusEl.setText(`Session: ${this.currentSessionId.substring(0, 8)}…`);
      this.sessionStatusEl.title = this.currentSessionId;
    } else {
      this.sessionStatusEl.setText('New session');
      this.sessionStatusEl.title = '';
    }
  }

  private setSendState(running: boolean) {
    this.sendBtn.dataset.state = running ? 'running' : '';
    this.sendBtn.disabled = false;
    setIcon(this.sendBtn, running ? 'square' : 'arrow-up');
    this.sendBtn.title = running ? 'Stop' : 'Send message';
  }

  private async handleSend() {
    const prompt = this.inputEl.value.trim();
    if (!prompt) return;

    if (!this.plugin.claudeBinaryPath) {
      this.appendMessage('system', 'Claude binary not found. Check Cortex settings.');
      return;
    }

    const unlock = () => this.setSendState(false);
    const isNewSession = !this.currentSessionId;
    const firstPrompt = isNewSession ? prompt : undefined;
    log('handleSend — session:', this.currentSessionId ?? 'new', '— prompt:', prompt.substring(0, 60));

    this.inputHistory.push(prompt);
    this.historyIndex = -1;
    this.inputDraft = '';
    this.inputEl.value = '';
    this.setSendState(true);
    this.appendMessage('user', prompt);

    // Response group: tool events (above) + assistant bubble + token stats (below)
    const responseGroupEl = this.messagesEl.createDiv({ cls: 'cortex-response-group' });
    const toolEventsEl = responseGroupEl.createDiv({ cls: 'cortex-tool-events' });
    toolEventsEl.style.display = 'none';
    const assistantEl = responseGroupEl.createDiv({ cls: 'cortex-message cortex-assistant' });
    const statusEl = assistantEl.createSpan({ cls: 'cortex-status', text: 'Thinking…' });
    const tokenStatsEl = responseGroupEl.createDiv({ cls: 'cortex-token-stats' });
    tokenStatsEl.style.display = 'none';
    this.scrollToBottom();

    // Prepend open file context so Claude knows what note(s) are visible
    let activeFileNote = '';
    {
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      const parents = new Set(leaves.map(l => l.parent));
      const isSplit = parents.size > 1;
      const isStacked = !isSplit && leaves.length > 1;

      if (isSplit && this.plugin.settings.injectSplitPaneFiles) {
        const paths = leaves.map(l => (l.view as any).file?.path).filter(Boolean) as string[];
        const unique = [...new Set(paths)];
        activeFileNote = `[Open in split view: ${unique.join(' | ')}]\n\n`;
      } else if (isStacked && this.plugin.settings.injectStackedTabFiles) {
        const paths = leaves.map(l => (l.view as any).file?.path).filter(Boolean) as string[];
        const unique = [...new Set(paths)];
        activeFileNote = `[Open in stacked tabs: ${unique.join(' | ')}]\n\n`;
      } else {
        const activeFile = this.app.workspace.getActiveFile();
        activeFileNote = activeFile ? `[Active note: ${activeFile.path}]\n\n` : '';
      }
    }

    let finalPrompt = prompt;
    if (this.pendingContexts.length > 0) {
      const contextBlock = this.pendingContexts
        .map(c => {
          if (c.type === 'url') return `**[URL: ${c.text}]**`;
          if (c.type === 'image') return `**[Attached image: ${c.source}]**\nRead this file to view the image: ${c.text}`;
          if (c.type === 'pdf') return `**[Attached PDF: ${c.source}]**\nRead this file to view the document: ${c.text}`;
          return `**[Context from ${c.source}]**\n${c.text}`;
        })
        .join('\n\n');
      finalPrompt = `${contextBlock}\n\n${prompt}`;
      this.pendingContexts = this.pendingContexts.filter(c => c.pinned);
      this.renderContextZone();
    }

    if (isNewSession) {
      const ctx = new ContextManager(
        this.app,
        this.plugin.settings.contextFilePath,
        this.plugin.settings.autonomousMemory,
        this.plugin.settings.vaultTreeDepth,
        this.plugin.settings.commandAllowlist,
      );
      const context = await ctx.buildSessionContext();
      const promptTokens = estimateTokens(finalPrompt);
      finalPrompt = ctx.injectContext(context, finalPrompt);
      if (context) {
        const contextTokens = estimateTokens(context);
        const totalTokens = estimateTokens(finalPrompt);
        log(`[NEW SESSION] Context: ~${contextTokens} tokens, Prompt: ~${promptTokens} tokens, Total: ~${totalTokens} tokens`);
      } else {
        log(`[NEW SESSION] No context injected, Prompt: ~${promptTokens} tokens`);
      }
    } else {
      if (this.pendingSystemMessage) {
        finalPrompt = `${this.pendingSystemMessage}\n\n${finalPrompt}`;
        this.pendingSystemMessage = null;
      }
      log(`[CONTINUE SESSION ${this.currentSessionId?.substring(0, 8)}] Prompt: ~${estimateTokens(finalPrompt)} tokens`);
    }

    finalPrompt = activeFileNote + finalPrompt;

    let proc: ReturnType<typeof spawnClaude>;
    try {
      proc = spawnClaude({
        binaryPath: this.plugin.claudeBinaryPath!,
        prompt: finalPrompt,
        vaultRoot: (this.app.vault.adapter as any).basePath,
        env: this.plugin.shellEnv,
        resumeSessionId: this.currentSessionId,
        permissionMode: this.sessionPermissionOverride ?? this.plugin.settings.permissionMode,
      });
      this.activeProc = proc;
    } catch (e) {
      assistantEl.setText(`Failed to start claude: ${e}`);
      unlock();
      return;
    }

    let toolCallCount = 0;
    let accumulated = '';
    let uiBridgeActionCount = 0;
    let turnInputTokens = 0;
    let turnCacheTokens = 0;
    let turnOutputTokens = 0;
    const pendingQueries: VaultQuery[] = [];

    parseStreamOutput(proc, {
      onText: (delta) => {
        statusEl.remove();
        accumulated += delta;
        // Catch any action lines that arrive via text (belt-and-suspenders)
        if (this.plugin.settings.uiBridgeEnabled) {
          const { clean, actions } = extractActions(accumulated);
          accumulated = clean;
          uiBridgeActionCount += actions.length;
          actions.forEach(a => executeAction(this.app, a, this.bridgeOptions()));
        }
        assistantEl.setText(accumulated);
        this.scrollToBottom();
      },
      onAction: (line) => {
        if (this.plugin.settings.uiBridgeEnabled) {
          try {
            const { actions } = extractActions(line + '\n');
            uiBridgeActionCount += actions.length;
            actions.forEach(a => executeAction(this.app, a, this.bridgeOptions()));
          } catch { /* malformed — already logged in extractActions */ }
        }
      },
      onQuery: (line) => {
        try {
          const q = JSON.parse(line.slice(QUERY_PREFIX.length)) as VaultQuery;
          pendingQueries.push(q);
          log('onQuery — queued:', q.query, q.mode, q.path ?? '');
        } catch { log('onQuery — malformed line:', line.substring(0, 100)); }
      },
      onToolCall: (tool, input) => {
        const key = tool.toLowerCase();
        statusEl.setText(TOOL_STATUS[key] ?? 'Working…');
        log('onToolCall —', tool, JSON.stringify(input).substring(0, 120));
        toolCallCount++;
        if (toolEventsEl.style.display === 'none') toolEventsEl.style.display = 'flex';
        const row = toolEventsEl.createDiv({ cls: 'cortex-tool-event' });
        const iconEl = row.createSpan({ cls: 'cortex-tool-event-icon' });
        setIcon(iconEl, TOOL_ICONS[key] ?? 'zap');
        const detail = extractToolDetail(key, input);
        row.createSpan({ cls: 'cortex-tool-event-label', text: detail ? `${tool}: ${detail}` : tool });
        this.scrollToBottom();
      },
      onPermissionDenied: (denials) => {
        this.renderPermissionDenials(denials, responseGroupEl, prompt);
      },
      onDone: (sessionId) => {
        statusEl.remove();
        this.activeProc = null;
        if (!accumulated && !uiBridgeActionCount && !sessionId) this.appendMessage('system', 'Interrupted.');

        if (sessionId) {
          const vaultRoot = (this.app.vault.adapter as any).basePath;
          const now = new Date().toISOString();

          if (this.placeholderSessionId) {
            this.currentSessionId = sessionId;
            this.currentSessionFileId = this.placeholderSessionId;
            if (firstPrompt) this.currentSessionTitle = titleFromPrompt(firstPrompt);
            saveSession(vaultRoot, {
              id: this.placeholderSessionId,
              title: this.currentSessionTitle ?? 'Untitled session',
              createdAt: this.currentSessionCreatedAt ?? now,
              updatedAt: now,
              claudeSessionId: sessionId,
            });
            const placeholderId = this.placeholderSessionId;
            this.placeholderSessionId = undefined;
            log('Placeholder session updated:', placeholderId, '→', sessionId);
          } else if (isNewSession && firstPrompt) {
            this.currentSessionId = sessionId;
            this.currentSessionFileId = sessionId;
            this.currentSessionTitle = titleFromPrompt(firstPrompt);
            this.currentSessionCreatedAt = now;
            saveSession(vaultRoot, {
              id: sessionId,
              title: this.currentSessionTitle,
              createdAt: now,
              updatedAt: now,
              claudeSessionId: sessionId,
            });
            log('Session saved:', sessionId, this.currentSessionTitle);
          } else if (this.currentSessionId) {
            const fileId = this.currentSessionFileId ?? this.currentSessionId;
            saveSession(vaultRoot, {
              id: fileId,
              title: this.currentSessionTitle ?? this.currentSessionId.substring(0, 8),
              createdAt: this.currentSessionCreatedAt ?? now,
              updatedAt: now,
              claudeSessionId: this.currentSessionId,
            });
          }

          this.updateSessionStatus();
        }

        // Collapse tool events into a toggle
        if (toolCallCount > 0) {
          const rows = Array.from(toolEventsEl.querySelectorAll('.cortex-tool-event')) as HTMLElement[];
          rows.forEach(r => { r.style.display = 'none'; });
          const s = toolCallCount === 1 ? '' : 's';
          const toggle = toolEventsEl.createEl('button', {
            cls: 'cortex-tool-toggle',
            text: `${toolCallCount} tool call${s} ▶`,
          });
          toolEventsEl.insertBefore(toggle, toolEventsEl.firstChild);
          let expanded = false;
          toggle.addEventListener('click', () => {
            expanded = !expanded;
            rows.forEach(r => { r.style.display = expanded ? 'flex' : 'none'; });
            toggle.setText(`${toolCallCount} tool call${s} ${expanded ? '▼' : '▶'}`);
          });
        }

        if (!accumulated && uiBridgeActionCount) {
          assistantEl.remove();
        } else if (!accumulated) {
          assistantEl.setText('(no response)');
        } else if (this.isAuthError(accumulated)) {
          this.renderAuthError(assistantEl);
        } else {
          assistantEl.dataset.markdown = accumulated;
          assistantEl.empty();
          MarkdownRenderer.render(this.app, accumulated, assistantEl, '', this);
        }
        this.scrollToBottom();

        // Handle vault queries collected during this turn
        const showQueries = pendingQueries.filter(q => q.mode === 'show');
        const injectQueries = pendingQueries.filter(q => q.mode === 'inject');

        for (const q of showQueries) {
          const result = resolveQuery(this.app, q);
          this.renderQueryResultCard(responseGroupEl, result);
        }

        if (injectQueries.length > 0) {
          // Stay locked — handleVaultInject will call unlock when done
          this.handleVaultInject(injectQueries, responseGroupEl, unlock);
          return;
        }

        unlock();
      },
      onUsage: (usage) => {
        // context window = max of cache_read (full history) + new input + output
        const total = Math.max(usage.cacheReadTokens, this.sessionContextTokens)
          + usage.inputTokens + usage.outputTokens;
        this.sessionContextTokens = total;
        this.tokenGaugeEl.style.display = '';
        this.updateTokenGauge(total);

        // Output tokens arrive as 1 per streaming delta — accumulate.
        // Input and cache tokens are reported in full on the first event — take max.
        turnOutputTokens += usage.outputTokens;
        turnInputTokens = Math.max(turnInputTokens, usage.inputTokens);
        turnCacheTokens = Math.max(turnCacheTokens, usage.cacheReadTokens);

        const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
        const parts = [
          `${fmt(turnOutputTokens)} out`,
          `${fmt(turnInputTokens)} in`,
        ];
        if (turnCacheTokens > 0) parts.push(`${fmt(turnCacheTokens)} cached`);
        tokenStatsEl.setText(parts.join(' · '));
        tokenStatsEl.style.display = '';
      },
      onError: (err) => {
        this.appendMessage('system', `stderr: ${err.trim()}`);
      },
    });

    proc.on('error', (err) => {
      assistantEl.setText(`Process error: ${err.message}`);
      unlock();
    });
  }

  private renderSetupPanel() {
    this.inputEl.disabled = true;
    this.inputEl.placeholder = 'Complete setup above to start chatting…';
    this.sendBtn.disabled = true;

    const isWin = process.platform === 'win32';
    const card = this.messagesEl.createDiv({ cls: 'cortex-setup-card' });

    card.createEl('h3', { text: 'ERROR: Claude Code not found', cls: 'cortex-setup-title' });
    card.createEl('p', {
      text: 'Cortex requires the Claude Code CLI (included with Claude Pro/Max). ' +
        'Follow the steps below, then click Check again.',
      cls: 'cortex-setup-intro',
    });

    // Step 1 — Install
    const step1 = card.createDiv({ cls: 'cortex-setup-step' });
    step1.createEl('p', { text: 'Step 1 — Install Claude Code', cls: 'cortex-setup-step-title' });
    if (isWin) {
      step1.createEl('p', { text: 'Open PowerShell (not WSL, not Command Prompt) and run:', cls: 'cortex-setup-note' });
      this.renderCodeRow(step1, 'irm https://claude.ai/install.ps1 | iex');
    } else {
      step1.createEl('p', { text: 'Run in your terminal:', cls: 'cortex-setup-note' });
      this.renderCodeRow(step1, 'curl -fsSL https://claude.ai/install.sh | bash');
    }

    // Step 2 — Verify
    const step2 = card.createDiv({ cls: 'cortex-setup-step' });
    step2.createEl('p', {
      text: `Step 2 — Verify (run in ${isWin ? 'PowerShell' : 'terminal'})`,
      cls: 'cortex-setup-step-title',
    });
    this.renderCodeRow(step2, 'claude --version');

    // Step 3 — Authenticate
    const step3 = card.createDiv({ cls: 'cortex-setup-step' });
    step3.createEl('p', { text: 'Step 3 — Log in', cls: 'cortex-setup-step-title' });
    step3.createEl('p', {
      text: 'This opens a browser window to authenticate with your Claude account (Pro or Max required):',
      cls: 'cortex-setup-note',
    });
    this.renderCodeRow(step3, 'claude login');

    // Already installed? Override path
    const pathSection = card.createDiv({ cls: 'cortex-setup-step' });
    pathSection.createEl('p', {
      text: 'Already installed and still seeing this?',
      cls: 'cortex-setup-step-title',
    });
    pathSection.createEl('p', {
      text: 'Claude Code may not be on the auto-detected PATH. Enter the full path to your claude binary below, then click Check again.',
      cls: 'cortex-setup-note',
    });
    const pathRow = pathSection.createDiv({ cls: 'cortex-setup-code-row' });
    const pathInput = pathRow.createEl('input', { cls: 'cortex-setup-path-input' });
    pathInput.type = 'text';
    pathInput.placeholder = isWin ? 'C:\\Users\\you\\AppData\\Local\\Programs\\claude\\claude.exe' : '/usr/local/bin/claude';
    pathInput.value = this.plugin.settings.binaryPath ?? '';
    pathInput.addEventListener('change', async () => {
      this.plugin.settings.binaryPath = pathInput.value.trim();
      await this.plugin.saveSettings();
    });

    // Action buttons
    const btnRow = card.createDiv({ cls: 'cortex-setup-btn-row' });

    const docsLink = btnRow.createEl('a', {
      text: 'Claude Code install guide ↗',
      href: 'https://code.claude.com/docs/en/overview#native-install-recommended',
      cls: 'cortex-setup-docs-link',
    });
    docsLink.setAttr('target', '_blank');
    docsLink.setAttr('rel', 'noopener');

    const checkBtn = btnRow.createEl('button', { text: 'Check again', cls: 'mod-cta cortex-setup-check-btn' });
    checkBtn.addEventListener('click', async () => {
      this.plugin.claudeBinaryPath = findClaudeBinary(this.plugin.settings.binaryPath);
      if (this.plugin.claudeBinaryPath) {
        await this.onOpen();
      } else {
        const err = card.createEl('p', {
          text: isWin
            ? 'Still not found. Ensure you installed in PowerShell (not WSL), then restart Obsidian.'
            : 'Still not found. Make sure claude is on your PATH, then restart Obsidian.',
          cls: 'cortex-setup-error',
        });
        setTimeout(() => err.remove(), 6000);
      }
    });
  }

  private isAuthError(text: string): boolean {
    return text.includes('Not logged in');
  }

  private renderAuthError(el: HTMLElement) {
    el.empty();
    el.createEl('p', { text: 'ERROR: Claude Code is not authenticated.', cls: 'cortex-setup-step-title' });
    el.createEl('p', {
      text: 'Click Open terminal below. Claude Code will launch and open a browser window to log in. ' +
        'If the browser does not open automatically, press c in the terminal to copy the login URL.',
      cls: 'cortex-setup-note',
    });
    el.createEl('p', {
      text: 'A Claude Pro or Max subscription is required.',
      cls: 'cortex-setup-note',
    });

    const btnRow = el.createDiv({ cls: 'cortex-setup-btn-row' });

    const loginBtn = btnRow.createEl('button', { text: 'Open terminal', cls: 'mod-cta cortex-setup-check-btn' });
    loginBtn.addEventListener('click', () => {
      const binaryPath = this.plugin.claudeBinaryPath!;
      const isWin = process.platform === 'win32';

      if (isWin) {
        spawn('cmd.exe', ['/c', 'start', 'powershell.exe', '-NoExit', '-Command', `& '${binaryPath}'`], { detached: true });
      } else {
        const term = process.platform === 'darwin' ? 'open' : 'x-terminal-emulator';
        const args = process.platform === 'darwin'
          ? ['-a', 'Terminal', '--args', binaryPath]
          : ['-e', binaryPath];
        spawn(term, args, { detached: true });
      }

      loginBtn.setText('Opened — log in, then click Done');
      loginBtn.disabled = true;

      const doneBtn = btnRow.createEl('button', { text: 'Done', cls: 'cortex-setup-check-btn' });
      doneBtn.addEventListener('click', async () => {
        doneBtn.setText('Checking…');
        doneBtn.disabled = true;
        await this.onOpen();
      });
    });
  }

  private renderPermissionDenials(denials: PermissionDenial[], container: HTMLElement, retryPrompt: string) {
    const card = container.createDiv({ cls: 'cortex-permission-card' });
    card.createEl('p', { cls: 'cortex-permission-title', text: `⚠ ${denials.length} operation${denials.length !== 1 ? 's' : ''} blocked by permission settings` });

    const list = card.createEl('ul', { cls: 'cortex-permission-list' });
    for (const d of denials) {
      const detail = extractToolDetail(d.tool.toLowerCase(), d.input);
      list.createEl('li', { text: detail ? `${d.tool}: ${detail}` : d.tool });
    }

    const currentMode = this.sessionPermissionOverride ?? this.plugin.settings.permissionMode;
    if (currentMode !== 'full') {
      const btnRow = card.createDiv({ cls: 'cortex-permission-btn-row' });
      const upgradeBtn = btnRow.createEl('button', {
        cls: 'mod-cta',
        text: 'Allow full access for this session',
      });
      upgradeBtn.addEventListener('click', () => {
        this.sessionPermissionOverride = 'full';
        upgradeBtn.setText('↺ Retrying…');
        upgradeBtn.disabled = true;
        log('Session permission override set to full');
        this.inputEl.value = retryPrompt;
        this.handleSend();
      });
      btnRow.createEl('a', {
        cls: 'cortex-permission-settings-link',
        text: 'Change default in settings',
        href: '#',
      }).addEventListener('click', (e) => {
        e.preventDefault();
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById('cortex');
      });
    }
    this.scrollToBottom();
  }

  private renderCodeRow(parent: HTMLElement, code: string) {
    const row = parent.createDiv({ cls: 'cortex-setup-code-row' });
    row.createEl('code', { text: code, cls: 'cortex-setup-code' });
    const copyBtn = row.createEl('button', { text: 'Copy', cls: 'cortex-setup-copy-btn' });
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.setText('Copied!');
        setTimeout(() => copyBtn.setText('Copy'), 2000);
      });
    });
  }

  private handleAtMention() {
    const { value, selectionStart } = this.inputEl;
    if (selectionStart === null) { this.atDropdownHide(); return; }

    const before = value.substring(0, selectionStart);
    const match = before.match(/@(\S*)$/);
    if (!match) { this.atDropdownHide(); return; }

    const textExts = new Set(
      this.plugin.settings.atMentionExtensions.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    );
    const query = match[1].toLowerCase();
    const activeFile = this.app.workspace.getActiveFile();
    const files = this.app.vault.getFiles()
      .filter(f => textExts.has(f.extension) && (!query || f.basename.toLowerCase().includes(query)))
      .sort((a, b) => {
        // Active note always sorts first when no query is typed
        if (!query) {
          if (a === activeFile) return -1;
          if (b === activeFile) return 1;
        }
        return a.basename.localeCompare(b.basename);
      })
      .slice(0, 8);

    if (files.length === 0) { this.atDropdownHide(); return; }

    this.atDropdownItems = files;
    if (this.atDropdownIndex < 0 || this.atDropdownIndex >= files.length) {
      this.atDropdownIndex = 0;
    }
    this.atDropdownRender();
  }

  private atDropdownRender() {
    const el = this.atDropdownEl;
    el.empty();
    el.style.display = 'block';
    this.atDropdownItems.forEach((file, i) => {
      const item = el.createDiv({ cls: 'cortex-at-item' + (i === this.atDropdownIndex ? ' cortex-at-item-active' : '') });
      const nameEl = item.createSpan({ cls: 'cortex-at-item-name', text: file.basename });
      if (file.extension !== 'md') nameEl.createSpan({ cls: 'cortex-at-item-ext', text: '.' + file.extension });
      const parentPath = file.parent?.path;
      if (parentPath && parentPath !== '/') {
        item.createSpan({ cls: 'cortex-at-item-path', text: parentPath });
      }
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent textarea blur before select fires
        this.atDropdownIndex = i;
        this.atDropdownSelect();
      });
    });
  }

  private atDropdownNav(dir: number) {
    this.atDropdownIndex = Math.max(0, Math.min(this.atDropdownItems.length - 1, this.atDropdownIndex + dir));
    this.atDropdownRender();
  }

  private async atDropdownSelect() {
    const file = this.atDropdownItems[this.atDropdownIndex];
    if (!file) return;
    this.atDropdownHide();

    // Remove @query from textarea and restore cursor
    const { value, selectionStart } = this.inputEl;
    if (selectionStart !== null) {
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionStart);
      const newBefore = before.replace(/@\S*$/, '');
      this.inputEl.value = newBefore + after;
      this.inputEl.setSelectionRange(newBefore.length, newBefore.length);
    }

    const content = await this.app.vault.read(file);
    this.injectSelectionContext(content, file.basename);
  }

  private atDropdownHide() {
    this.atDropdownEl.style.display = 'none';
    this.atDropdownItems = [];
    this.atDropdownIndex = -1;
  }

  private renderContextZone() {
    const zone = this.pendingContextZone;
    zone.empty();
    if (this.pendingContexts.length === 0) { zone.style.display = 'none'; return; }
    zone.style.display = 'flex';
    for (const entry of this.pendingContexts) {
      const row = zone.createDiv({ cls: 'cortex-pending-context-row' + (entry.pinned ? ' cortex-context-pinned' : '') });
      const preview = entry.text.length > 80 ? entry.text.substring(0, 80) + '…' : entry.text;
      const iconName = entry.type === 'image' ? 'image' : entry.type === 'pdf' ? 'file-text' : entry.type === 'url' ? 'link' : 'paperclip';
      const iconEl = row.createSpan({ cls: 'cortex-pending-context-icon' });
      setIcon(iconEl, iconName);
      row.createSpan({ cls: 'cortex-pending-context-label', text: `${entry.source}: ` });
      if (entry.type !== 'image' && entry.type !== 'pdf') {
        row.createSpan({ cls: 'cortex-pending-context-preview', text: preview });
      }
      const pinBtn = row.createEl('button', { cls: 'cortex-context-pin' });
      setIcon(pinBtn, entry.pinned ? 'pin-off' : 'pin');
      pinBtn.title = entry.pinned ? 'Unpin (remove after send)' : 'Pin (keep after send)';
      pinBtn.addEventListener('click', () => { entry.pinned = !entry.pinned; this.renderContextZone(); });
      const clearBtn = row.createEl('button', { cls: 'cortex-context-clear', text: '×' });
      clearBtn.title = 'Remove';
      clearBtn.addEventListener('click', () => {
        this.pendingContexts.splice(this.pendingContexts.indexOf(entry), 1);
        this.renderContextZone();
      });
    }
  }

  private scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private updateTokenGauge(tokens: number) {
    const arc = this.tokenGaugeEl.querySelector('.cortex-gauge-arc') as SVGCircleElement | null;
    if (!arc) return;
    const R = 7, C = R * 2 * Math.PI;
    const fraction = Math.min(tokens / ClaudeView.CONTEXT_WINDOW, 1);
    arc.setAttribute('stroke-dashoffset', String(C * (1 - fraction)));
    // Color shifts green → yellow → orange → red as context fills
    const cls = fraction < 0.6 ? 'low' : fraction < 0.8 ? 'mid' : fraction < 0.95 ? 'high' : 'full';
    arc.setAttribute('class', `cortex-gauge-arc cortex-gauge-${cls}`);
    const remaining = Math.round((1 - fraction) * 100);
    const label = tokens === 0
      ? 'Context window empty. Click to compact.'
      : `${remaining}% of context remaining before auto-compaction. Click to compact now.`;
    this.tokenGaugeEl.setAttribute('aria-label', label);
    const titleEl = this.tokenGaugeEl.querySelector('title');
    if (titleEl) titleEl.textContent = label;
  }

  private compactSession() {
    const sessionId = this.currentSessionId;
    if (!sessionId) {
      new Notice('Cortex: no active session to compact.');
      return;
    }
    // Optimistic reset — update gauge immediately
    this.sessionContextTokens = 0;
    this.updateTokenGauge(0);
    new Notice('Cortex: compacting session…');
    const proc = spawnClaude({
      binaryPath: this.plugin.claudeBinaryPath!,
      prompt: '/compact',
      vaultRoot: (this.app.vault.adapter as any).basePath,
      env: this.plugin.shellEnv,
      resumeSessionId: sessionId,
      permissionMode: this.sessionPermissionOverride ?? this.plugin.settings.permissionMode,
    });
    // Drain stdout so the process doesn't stall on a full buffer
    proc.stdout?.resume();
    proc.on('close', () => new Notice('Cortex: session compacted.'));
    proc.on('error', (err) => new Notice(`Cortex: compaction failed — ${err.message}`));
  }

  private attachClickOutside: ((e: MouseEvent) => void) | null = null;

  private toggleAttachPopover(anchorBtn: HTMLElement) {
    const showing = this.attachPopoverEl.style.display !== 'none';
    if (showing) { this.closeAttachPopover(); return; }
    this.attachPopoverEl.style.display = 'flex';
    anchorBtn.classList.add('is-active');
    // Close on any click outside the popover or anchor
    this.attachClickOutside = (e: MouseEvent) => {
      if (!this.attachPopoverEl.contains(e.target as Node) && e.target !== anchorBtn) {
        this.closeAttachPopover();
      }
    };
    setTimeout(() => document.addEventListener('click', this.attachClickOutside!), 0);
  }

  private closeAttachPopover() {
    this.attachPopoverEl.style.display = 'none';
    this.attachPopoverEl.closest('.cortex-input-area')
      ?.querySelector('.cortex-icon-btn.is-active')
      ?.classList.remove('is-active');
    if (this.attachClickOutside) {
      document.removeEventListener('click', this.attachClickOutside);
      this.attachClickOutside = null;
    }
  }

  private openFilePicker() {
    const TEXT_EXTS = new Set(['txt', 'md', 'fountain', 'js', 'ts', 'jsx', 'tsx', 'json', 'css', 'html', 'xml', 'csv', 'yaml', 'yml', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'ps1']);
    const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif', 'avif']);
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
        // file.path is undefined in Obsidian's sandboxed renderer — read binary
        // data and save to vault tmp so Claude always gets a readable path.
        const filePath = this.saveBinaryToTmp(f.name, await f.arrayBuffer());
        const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
        this.pendingContexts.push({ text: filePath, source: f.name, pinned: false, type });
      } else {
        const text = TEXT_EXTS.has(ext) ? await f.text() : f.name;
        this.pendingContexts.push({ text, source: f.name, pinned: false });
      }
      this.renderContextZone();
      this.inputEl.focus();
    };
    input.click();
  }

  private async handlePaste(e: ClipboardEvent): Promise<void> {
    const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif', 'avif']);

    // Use Electron's clipboard API to get real file paths when a file was
    // copied from Explorer. Works even with context isolation unlike file.path.
    try {
      const { clipboard } = require('electron') as { clipboard: { readFilePaths(): string[] } };
      const filePaths = clipboard.readFilePaths();
      if (filePaths.length > 0) {
        let handled = false;
        for (const filePath of filePaths) {
          const name = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
          const ext = name.split('.').pop()?.toLowerCase() ?? '';
          if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
            e.preventDefault();
            const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
            this.pendingContexts.push({ text: filePath, source: name, pinned: false, type });
            handled = true;
          }
        }
        if (handled) { this.renderContextZone(); return; }
      }
    } catch { /* Electron API unavailable — fall through */ }

    // clipboardData.files has the real filename even when readFilePaths() fails.
    // file.path is unavailable (context isolation) so save binary data to tmp.
    // Always generate a unique paste name — Windows names every screenshot "image.jpg".
    const files = e.clipboardData?.files;
    if (files?.length) {
      for (const f of Array.from(files)) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
          e.preventDefault();
          const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
          const uniqueName = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const filePath = this.saveBinaryToTmp(uniqueName, await f.arrayBuffer());
          this.pendingContexts.push({ text: filePath, source: uniqueName, pinned: false, type });
          this.renderContextZone();
          return;
        }
      }
    }

    // Last resort: raw image data from clipboard (screenshots have no filename)
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = item.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
        const filename = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const filePath = this.saveBinaryToTmp(filename, await blob.arrayBuffer());
        this.pendingContexts.push({ text: filePath, source: filename, pinned: false, type: 'image' });
        this.renderContextZone();
        return;
      }
    }
  }

  private async handleDroppedFiles(files: FileList): Promise<void> {
    const TEXT_EXTS = new Set(['txt', 'md', 'fountain', 'js', 'ts', 'jsx', 'tsx', 'json', 'css', 'html', 'xml', 'csv', 'yaml', 'yml', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'ps1']);
    const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif', 'avif']);
    for (const f of Array.from(files)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
        const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
        const filePath = this.saveBinaryToTmp(f.name, await f.arrayBuffer());
        this.pendingContexts.push({ text: filePath, source: f.name, pinned: false, type });
      } else if (TEXT_EXTS.has(ext)) {
        const text = await f.text();
        this.pendingContexts.push({ text, source: f.name, pinned: false });
      } else {
        // Unknown binary — pass filename; Claude can attempt to read it
        this.pendingContexts.push({ text: f.name, source: f.name, pinned: false });
      }
    }
    this.renderContextZone();
    this.inputEl.focus();
  }

  private saveBinaryToTmp(filename: string, data: ArrayBuffer): string {
    const vaultRoot = (this.app.vault.adapter as any).basePath;
    const tmpDir = join(vaultRoot, '.obsidian', 'plugins', 'cortex', 'tmp');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, filename);
    writeFileSync(filePath, Buffer.from(data));
    return filePath;
  }

  private attachUrl(url: string) {
    const label = url.replace(/^https?:\/\//, '').split('/')[0];
    this.pendingContexts.push({ text: url, source: label, pinned: false, type: 'url' });
    this.renderContextZone();
    this.inputEl.focus();
  }

  /** Render a vault query result card inside a response group (mode: show). */
  private renderQueryResultCard(containerEl: HTMLElement, result: VaultQueryResult) {
    const card = containerEl.createDiv({ cls: 'cortex-vault-query-card' });
    const header = card.createDiv({ cls: 'cortex-vault-query-header' });
    const iconEl = header.createSpan({ cls: 'cortex-vault-query-icon' });
    setIcon(iconEl, 'git-branch');
    header.createSpan({ cls: 'cortex-vault-query-label', text: queryLabel(result.query) });

    const body = card.createDiv({ cls: 'cortex-vault-query-body' });
    if (result.error) {
      body.createSpan({ cls: 'cortex-vault-query-error', text: `Error: ${result.error}` });
      return;
    }

    const r = result.result as Record<string, unknown>;
    const items: string[] = Array.isArray(r.backlinks) ? r.backlinks as string[]
      : Array.isArray(r.outlinks) ? r.outlinks as string[]
      : Array.isArray(r.tags) ? r.tags as string[]
      : Array.isArray(r.files) ? r.files as string[]
      : [];

    if (items.length === 0) {
      body.createSpan({ cls: 'cortex-vault-query-empty', text: 'No results.' });
    } else {
      const list = body.createEl('ul', { cls: 'cortex-vault-query-list' });
      for (const item of items) {
        list.createEl('li', { text: item });
      }
    }
    this.scrollToBottom();
  }

  /** Auto-fire a --resume turn injecting vault query results, then call unlock when done. */
  private handleVaultInject(queries: VaultQuery[], prevGroupEl: HTMLElement, unlock: () => void) {
    const results = queries.map(q => resolveQuery(this.app, q));

    // Render a compact card for each inject query so the user can see what was queried
    for (const r of results) {
      this.renderQueryResultCard(prevGroupEl, r);
    }

    const injectPrompt = buildInjectMessage(results);

    // New response group for Claude's continuation (no user message bubble)
    const responseGroupEl = this.messagesEl.createDiv({ cls: 'cortex-response-group' });
    const toolEventsEl = responseGroupEl.createDiv({ cls: 'cortex-tool-events' });
    toolEventsEl.style.display = 'none';
    const assistantEl = responseGroupEl.createDiv({ cls: 'cortex-message cortex-assistant' });
    const statusEl = assistantEl.createSpan({ cls: 'cortex-status', text: 'Processing vault data…' });
    const tokenStatsEl = responseGroupEl.createDiv({ cls: 'cortex-token-stats' });
    tokenStatsEl.style.display = 'none';
    this.setSendState(true);
    this.scrollToBottom();

    let proc: ReturnType<typeof spawnClaude>;
    try {
      proc = spawnClaude({
        binaryPath: this.plugin.claudeBinaryPath!,
        prompt: injectPrompt,
        vaultRoot: (this.app.vault.adapter as any).basePath,
        env: this.plugin.shellEnv,
        resumeSessionId: this.currentSessionId,
        permissionMode: this.sessionPermissionOverride ?? this.plugin.settings.permissionMode,
      });
      this.activeProc = proc;
    } catch (e) {
      assistantEl.setText(`Failed to resume after vault query: ${e}`);
      unlock();
      return;
    }

    let toolCallCount = 0;
    let accumulated = '';
    let uiBridgeActionCount = 0;
    let turnInputTokens = 0;
    let turnCacheTokens = 0;
    let turnOutputTokens = 0;

    parseStreamOutput(proc, {
      onText: (delta) => {
        statusEl.remove();
        accumulated += delta;
        if (this.plugin.settings.uiBridgeEnabled) {
          const { clean, actions } = extractActions(accumulated);
          accumulated = clean;
          uiBridgeActionCount += actions.length;
          actions.forEach(a => executeAction(this.app, a, this.bridgeOptions()));
        }
        assistantEl.setText(accumulated);
        this.scrollToBottom();
      },
      onAction: (line) => {
        if (this.plugin.settings.uiBridgeEnabled) {
          try {
            const { actions } = extractActions(line + '\n');
            uiBridgeActionCount += actions.length;
            actions.forEach(a => executeAction(this.app, a, this.bridgeOptions()));
          } catch { /* malformed */ }
        }
      },
      onToolCall: (tool, input) => {
        const key = tool.toLowerCase();
        statusEl.setText(TOOL_STATUS[key] ?? 'Working…');
        toolCallCount++;
        if (toolEventsEl.style.display === 'none') toolEventsEl.style.display = 'flex';
        const row = toolEventsEl.createDiv({ cls: 'cortex-tool-event' });
        const iconEl = row.createSpan({ cls: 'cortex-tool-event-icon' });
        setIcon(iconEl, TOOL_ICONS[key] ?? 'zap');
        const detail = extractToolDetail(key, input);
        row.createSpan({ cls: 'cortex-tool-event-label', text: detail ? `${tool}: ${detail}` : tool });
        this.scrollToBottom();
      },
      onPermissionDenied: (denials) => {
        this.renderPermissionDenials(denials, responseGroupEl, injectPrompt);
      },
      onUsage: (usage) => {
        const total = Math.max(usage.cacheReadTokens, this.sessionContextTokens)
          + usage.inputTokens + usage.outputTokens;
        this.sessionContextTokens = total;
        this.updateTokenGauge(total);

        turnOutputTokens += usage.outputTokens;
        turnInputTokens = Math.max(turnInputTokens, usage.inputTokens);
        turnCacheTokens = Math.max(turnCacheTokens, usage.cacheReadTokens);

        const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
        const parts = [`${fmt(turnOutputTokens)} out`, `${fmt(turnInputTokens)} in`];
        if (turnCacheTokens > 0) parts.push(`${fmt(turnCacheTokens)} cached`);
        tokenStatsEl.setText(parts.join(' · '));
        tokenStatsEl.style.display = '';
      },
      onError: (err) => {
        this.appendMessage('system', `stderr: ${err.trim()}`);
      },
      onDone: (sessionId) => {
        statusEl.remove();
        this.activeProc = null;

        if (sessionId && this.currentSessionId) {
          const vaultRoot = (this.app.vault.adapter as any).basePath;
          const now = new Date().toISOString();
          const fileId = this.currentSessionFileId ?? this.currentSessionId;
          saveSession(vaultRoot, {
            id: fileId,
            title: this.currentSessionTitle ?? this.currentSessionId.substring(0, 8),
            createdAt: this.currentSessionCreatedAt ?? now,
            updatedAt: now,
            claudeSessionId: this.currentSessionId,
          });
        }

        if (toolCallCount > 0) {
          const rows = Array.from(toolEventsEl.querySelectorAll('.cortex-tool-event')) as HTMLElement[];
          rows.forEach(r => { r.style.display = 'none'; });
          const s = toolCallCount === 1 ? '' : 's';
          const toggle = toolEventsEl.createEl('button', {
            cls: 'cortex-tool-toggle',
            text: `${toolCallCount} tool call${s} ▶`,
          });
          toolEventsEl.insertBefore(toggle, toolEventsEl.firstChild);
          let expanded = false;
          toggle.addEventListener('click', () => {
            expanded = !expanded;
            rows.forEach(r => { r.style.display = expanded ? 'flex' : 'none'; });
            toggle.setText(`${toolCallCount} tool call${s} ${expanded ? '▼' : '▶'}`);
          });
        }

        if (!accumulated && uiBridgeActionCount) {
          assistantEl.remove();
        } else if (!accumulated) {
          assistantEl.setText('(no response)');
        } else if (this.isAuthError(accumulated)) {
          this.renderAuthError(assistantEl);
        } else {
          assistantEl.dataset.markdown = accumulated;
          assistantEl.empty();
          MarkdownRenderer.render(this.app, accumulated, assistantEl, '', this);
        }
        this.scrollToBottom();
        unlock();
      },
    });

    proc.on('error', (err) => {
      assistantEl.setText(`Process error: ${err.message}`);
      unlock();
    });
  }

  private appendMessage(role: 'user' | 'assistant' | 'system', text: string): HTMLElement {
    const el = this.messagesEl.createDiv({ cls: `cortex-message cortex-${role}` });
    el.setText(text);
    this.scrollToBottom();
    return el;
  }
}

// ---------------------------------------------------------------------------
// Attach modals
// ---------------------------------------------------------------------------

class AttachUrlModal extends Modal {
  constructor(app: App, private onSubmit: (url: string) => void) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText('Attach URL');
    const input = this.contentEl.createEl('input', {
      cls: 'cortex-attach-url-input',
      attr: { type: 'text', placeholder: 'https://…', style: 'width:100%;box-sizing:border-box;' },
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const v = input.value.trim(); if (v) { this.onSubmit(v); this.close(); } }
      if (e.key === 'Escape') this.close();
    });
    setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}
