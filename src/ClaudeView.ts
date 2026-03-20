import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, setIcon, TFile } from 'obsidian';
import { spawn } from 'child_process';
import type CortexPlugin from '../main';
import { spawnClaude, parseStreamOutput, killProcess, findClaudeBinary, PermissionDenial, PermissionMode } from './ClaudeProcess';
import { extractActions, executeAction } from './UIBridge';
import { ContextManager } from './ContextManager';
import { log, estimateTokens } from './utils/logger';
import {
  StoredSession,
  saveSession,
  loadAllSessions,
  titleFromPrompt,
  canResumeLocally,
  loadSessionMessages,
} from './utils/sessionStorage';
import { SessionListModal } from './modals/SessionListModal';
import { ContextGenerationModal } from './ContextGenerationModal';
import { AboutModal } from './modals/AboutModal';

export const VIEW_TYPE_CLAUDE = 'cortex-chat';

// Maps from lowercase tool name to display values.
// Claude Code sends PascalCase names (Read, Write, Bash…) so we normalise to lowercase for lookup.
const TOOL_STATUS: Record<string, string> = {
  read:       'Reading…',
  write:      'Writing…',
  edit:       'Editing…',
  multiedit:  'Editing…',
  bash:       'Running command…',
  glob:       'Scanning vault…',
  grep:       'Searching…',
  ls:         'Listing…',
  webfetch:   'Fetching…',
  websearch:  'Searching the web…',
  todowrite:  'Updating tasks…',
  todoread:   'Reading tasks…',
};

const TOOL_ICONS: Record<string, string> = {
  read:       'file-text',
  write:      'file-edit',
  edit:       'file-edit',
  multiedit:  'file-edit',
  bash:       'terminal',
  glob:       'folder',
  grep:       'search',
  ls:         'folder',
  webfetch:   'globe',
  websearch:  'globe',
  todowrite:  'check-square',
  todoread:   'check-square',
};

function extractToolDetail(tool: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const inp = input as Record<string, unknown>;

  // Try path-like fields first (covers Read, Write, Edit, Glob, Grep, LS…)
  const pathVal = (inp.file_path ?? inp.path ?? inp.filePath) as string | undefined;
  if (pathVal) {
    // For commands that benefit from showing just the filename
    const key = tool.toLowerCase();
    if (key !== 'bash' && key !== 'grep' && key !== 'glob') {
      return pathVal.split(/[\\/]/).pop() ?? pathVal;
    }
    return pathVal;
  }

  // Bash: show the command
  if (inp.command) {
    const cmd = inp.command as string;
    return cmd.length > 70 ? cmd.substring(0, 70) + '…' : cmd;
  }

  // Web tools
  if (inp.url) return inp.url as string;
  if (inp.query) return inp.query as string;

  // Grep / Glob: show the pattern
  if (inp.pattern) return inp.pattern as string;

  return '';
}

export class ClaudeView extends ItemView {
  plugin: CortexPlugin;
  private inputEl: HTMLTextAreaElement;
  private messagesEl: HTMLElement;
  private sendBtn: HTMLButtonElement;
  private sessionStatusEl: HTMLElement;
  private currentSessionId: string | undefined;
  private currentSessionTitle: string | undefined;
  private currentSessionCreatedAt: string | undefined;
  private placeholderSessionId: string | undefined;
  private inputHistory: string[] = [];
  private historyIndex: number = -1;
  private inputDraft: string = '';
  private activeProc: ReturnType<typeof spawnClaude> | null = null;
  private pendingContexts: Array<{ text: string; source: string }> = [];
  private pendingContextZone: HTMLElement;
  /** Overrides settings.permissionMode for the current session only. Cleared on new session. */
  private sessionPermissionOverride: PermissionMode | null = null;
  private atDropdownEl: HTMLElement;
  private atDropdownItems: TFile[] = [];
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
    setIcon(settingsBtn, 'settings');
    settingsBtn.title = 'Open Cortex settings';
    settingsBtn.addEventListener('click', () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById('cortex');
    });

    this.messagesEl = root.createDiv({ cls: 'cortex-messages' });

    const inputArea = root.createDiv({ cls: 'cortex-input-area' });

    this.atDropdownEl = inputArea.createDiv({ cls: 'cortex-at-dropdown' });
    this.atDropdownEl.style.display = 'none';

    this.pendingContextZone = inputArea.createDiv({ cls: 'cortex-pending-context' });
    this.pendingContextZone.style.display = 'none';

    this.inputEl = inputArea.createEl('textarea', {
      cls: 'cortex-input',
      attr: { placeholder: 'Ask Cortex…', rows: '3' },
    });

    const inputToolbar = inputArea.createDiv({ cls: 'cortex-input-toolbar' });

    const attachBtn = inputToolbar.createEl('button', { cls: 'cortex-icon-btn cortex-input-toolbar-btn' });
    setIcon(attachBtn, 'paperclip');
    attachBtn.title = 'Attach file (coming soon)';
    attachBtn.disabled = true;

    const slashBtn = inputToolbar.createEl('button', { cls: 'cortex-icon-btn cortex-input-toolbar-btn' });
    setIcon(slashBtn, 'slash');
    slashBtn.title = 'Slash commands (coming soon)';
    slashBtn.disabled = true;

    inputToolbar.createDiv({ cls: 'cortex-input-toolbar-spacer' });

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
        if (e.key === 'ArrowUp')   { e.preventDefault(); this.atDropdownNav(-1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.atDropdownSelect(); return; }
        if (e.key === 'Escape')    { this.atDropdownHide(); return; }
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

    // If Claude binary is missing, show setup guide and stop here
    if (!this.plugin.claudeBinaryPath) {
      this.renderSetupPanel();
      return;
    }

    if (this.plugin.settings.resumeLastSession) {
      const vaultRoot = (this.app.vault.adapter as any).basePath;
      const sessions = loadAllSessions(vaultRoot);
      if (sessions.length > 0) {
        await this.loadSession(sessions[0]);
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

    saveSession(vaultRoot, newSession);
    this.placeholderSessionId = sessionId;
    this.currentSessionId = undefined;
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
        msgEl.classList.contains('cortex-assistant') ? 'Assistant' : 'System';
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

  injectSelectionContext(selection: string, sourceName: string) {
    const entry = { text: selection, source: sourceName };
    this.pendingContexts.push(entry);

    // Append a row to the attachment bar (shown above the textarea)
    const zone = this.pendingContextZone;
    zone.style.display = 'flex';

    const row = zone.createDiv({ cls: 'cortex-pending-context-row' });
    const preview = selection.length > 80 ? selection.substring(0, 80) + '…' : selection;
    row.createSpan({ cls: 'cortex-pending-context-label', text: `📎 ${sourceName}: ` });
    row.createSpan({ cls: 'cortex-pending-context-preview', text: preview });

    const clearBtn = row.createEl('button', { cls: 'cortex-context-clear', text: '×' });
    clearBtn.title = 'Remove';
    clearBtn.addEventListener('click', () => {
      const idx = this.pendingContexts.indexOf(entry);
      if (idx !== -1) this.pendingContexts.splice(idx, 1);
      row.remove();
      if (this.pendingContexts.length === 0) zone.style.display = 'none';
    });

    this.inputEl.focus();
  }

  private async loadSession(session: StoredSession) {
    this.placeholderSessionId = undefined;
    this.currentSessionId = session.claudeSessionId || undefined;
    this.currentSessionTitle = session.title;
    this.currentSessionCreatedAt = session.createdAt;
    this.messagesEl.empty();
    this.updateSessionStatus();

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

  private async handleSend() {
    const prompt = this.inputEl.value.trim();
    if (!prompt) return;

    if (!this.plugin.claudeBinaryPath) {
      this.appendMessage('system', 'Claude binary not found. Check Cortex settings.');
      return;
    }

    const setSendState = (running: boolean) => {
      this.sendBtn.dataset.state = running ? 'running' : '';
      this.sendBtn.disabled = false;
      setIcon(this.sendBtn, running ? 'square' : 'arrow-up');
      this.sendBtn.title = running ? 'Stop' : 'Send message';
    };
    const unlock = () => setSendState(false);
    const isNewSession = !this.currentSessionId;
    const firstPrompt = isNewSession ? prompt : undefined;
    log('handleSend — session:', this.currentSessionId ?? 'new', '— prompt:', prompt.substring(0, 60));

    this.inputHistory.push(prompt);
    this.historyIndex = -1;
    this.inputDraft = '';
    this.inputEl.value = '';
    setSendState(true);
    this.appendMessage('user', prompt);

    // Response group: tool events (above) + assistant bubble (below)
    const responseGroupEl = this.messagesEl.createDiv({ cls: 'cortex-response-group' });
    const toolEventsEl = responseGroupEl.createDiv({ cls: 'cortex-tool-events' });
    toolEventsEl.style.display = 'none';
    const assistantEl = responseGroupEl.createDiv({ cls: 'cortex-message cortex-assistant' });
    const statusEl = assistantEl.createSpan({ cls: 'cortex-status', text: 'Thinking…' });
    this.scrollToBottom();

    // Attach any pending selection context
    let finalPrompt = prompt;
    if (this.pendingContexts.length > 0) {
      const contextBlock = this.pendingContexts
        .map(c => `**[Context from ${c.source}]**\n${c.text}`)
        .join('\n\n');
      finalPrompt = `${contextBlock}\n\n${prompt}`;
      this.pendingContexts = [];
      this.pendingContextZone.empty();
      this.pendingContextZone.style.display = 'none';
    }

    if (isNewSession) {
      const ctx = new ContextManager(
        this.app,
        this.plugin.settings.contextFilePath,
        this.plugin.settings.autonomousMemory,
        this.plugin.settings.vaultTreeDepth,
      );
      const context = await ctx.buildSessionContext();
      finalPrompt = ctx.injectContext(context, prompt);
      if (context) {
        const contextTokens = estimateTokens(context);
        const promptTokens = estimateTokens(prompt);
        const totalTokens = estimateTokens(finalPrompt);
        log(`[NEW SESSION] Context: ~${contextTokens} tokens, Prompt: ~${promptTokens} tokens, Total: ~${totalTokens} tokens`);
      } else {
        const promptTokens = estimateTokens(prompt);
        log(`[NEW SESSION] No context injected, Prompt: ~${promptTokens} tokens`);
      }
    } else {
      log(`[CONTINUE SESSION ${this.currentSessionId?.substring(0, 8)}] Prompt: ~${estimateTokens(finalPrompt)} tokens`);
    }

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

    parseStreamOutput(proc, {
      onText: (delta) => {
        statusEl.remove();
        accumulated += delta;
        // Catch any action lines that arrive via text (belt-and-suspenders)
        if (this.plugin.settings.uiBridgeEnabled) {
          const { clean, actions } = extractActions(accumulated);
          accumulated = clean;
          actions.forEach(a => executeAction(this.app, a));
        }
        assistantEl.setText(accumulated);
        this.scrollToBottom();
      },
      onAction: (line) => {
        if (this.plugin.settings.uiBridgeEnabled) {
          try {
            const { actions } = extractActions(line + '\n');
            actions.forEach(a => executeAction(this.app, a));
          } catch { /* malformed — already logged in extractActions */ }
        }
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
        if (!accumulated) this.appendMessage('system', 'Interrupted.');

        if (sessionId) {
          const vaultRoot = (this.app.vault.adapter as any).basePath;
          const now = new Date().toISOString();

          if (this.placeholderSessionId) {
            this.currentSessionId = sessionId;
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
            saveSession(vaultRoot, {
              id: this.currentSessionId,
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

        if (!accumulated) {
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

    const query = match[1].toLowerCase();
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => !query || f.basename.toLowerCase().includes(query))
      .sort((a, b) => a.basename.localeCompare(b.basename))
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
      item.createSpan({ cls: 'cortex-at-item-name', text: file.basename });
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

  private scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private appendMessage(role: 'user' | 'assistant' | 'system', text: string): HTMLElement {
    const el = this.messagesEl.createDiv({ cls: `cortex-message cortex-${role}` });
    el.setText(text);
    this.scrollToBottom();
    return el;
  }
}
