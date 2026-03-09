import { ItemView, WorkspaceLeaf, MarkdownRenderer, Modal, App, Notice } from 'obsidian';
import type CortexPlugin from '../main';
import { spawnClaude, parseStreamOutput } from './ClaudeProcess';
import { ContextManager } from './ContextManager';
import { log, estimateTokens } from './utils/logger';
import {
  StoredSession,
  saveSession,
  loadAllSessions,
  titleFromPrompt,
  canResumeLocally,
  loadSessionMessages,
  deleteSession,
} from './utils/sessionStorage';

export const VIEW_TYPE_CLAUDE = 'cortex-chat';

// ---------------------------------------------------------------------------
// Session history modal
// ---------------------------------------------------------------------------

class SessionListModal extends Modal {
  sessions: StoredSession[];
  filteredSessions: StoredSession[];
  vaultRoot: string;
  onSelect: (session: StoredSession) => void;
  onNewSession: () => void;
  listContainer: HTMLElement | null = null;

  constructor(app: App, vaultRoot: string, sessions: StoredSession[], onSelect: (s: StoredSession) => void, onNewSession: () => void) {
    super(app);
    this.vaultRoot = vaultRoot;
    this.sessions = sessions;
    this.filteredSessions = sessions;
    this.onSelect = onSelect;
    this.onNewSession = onNewSession;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Session history' });

    // Top bar with search and new session button
    const topBar = contentEl.createDiv({ cls: 'cortex-modal-topbar' });

    // Search/filter input
    const filterInput = topBar.createEl('input', {
      cls: 'cortex-session-filter',
      attr: {
        type: 'text',
        placeholder: 'Search sessions…',
      },
    });
    filterInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      this.filteredSessions = this.sessions.filter(s =>
        s.title.toLowerCase().includes(query)
      );
      this.rerenderList();
    });

    // New session button
    const newSessionBtn = topBar.createEl('button', {
      text: '+ New',
      cls: 'cortex-new-session-btn',
    });
    newSessionBtn.addEventListener('click', () => this.createNewSession());

    // List container (will be re-rendered on filter)
    this.listContainer = contentEl.createDiv({ cls: 'cortex-session-list-container' });
    this.rerenderList();
  }

  private createNewSession() {
    this.onNewSession();
    this.close();
  }

  private rerenderList() {
    if (!this.listContainer) return;
    this.listContainer.empty();

    if (this.filteredSessions.length === 0) {
      this.listContainer.createEl('p', {
        text: this.sessions.length === 0 ? 'No saved sessions yet.' : 'No sessions match your search.',
        cls: 'cortex-modal-empty'
      });
      return;
    }

    const list = this.listContainer.createEl('ul', { cls: 'cortex-session-list' });
    for (const session of this.filteredSessions) {
      this.renderSessionItem(list, session);
    }
  }

  private renderSessionItem(list: HTMLElement, session: StoredSession) {
    const isNew = !session.claudeSessionId;
    const resumable = !isNew && canResumeLocally(session.claudeSessionId);
    const item = list.createEl('li', {
      cls: isNew
        ? 'cortex-session-item cortex-session-new'
        : resumable
          ? 'cortex-session-item'
          : 'cortex-session-item cortex-session-remote',
    });
    const titleEl = item.createEl('span', { text: session.title, cls: 'cortex-session-title' });
    item.createEl('span', {
      text: new Date(session.updatedAt).toLocaleString(),
      cls: 'cortex-session-date',
    });
    if (isNew) {
      item.createEl('span', { text: 'new', cls: 'cortex-session-new-badge' });
    } else if (!resumable) {
      item.createEl('span', { text: 'remote', cls: 'cortex-session-remote-badge' });
    }

    // Action buttons container
    const actionsDiv = item.createEl('div', { cls: 'cortex-session-actions' });

    const renameBtn = actionsDiv.createEl('button', { text: '✏', cls: 'cortex-rename-btn' });
    renameBtn.title = 'Rename session';

    const deleteBtn = actionsDiv.createEl('button', { text: '🗑', cls: 'cortex-delete-btn' });
    deleteBtn.title = 'Delete session';

    // Load session on row click (but not action buttons)
    item.addEventListener('click', (e) => {
      if (e.target === renameBtn || e.target === deleteBtn || (e.target as HTMLElement).closest('.cortex-session-actions')) {
        return;
      }
      this.onSelect(session);
      this.close();
    });

    // Delete button handler
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete session "${session.title}"? This cannot be undone.`)) {
        deleteSession(this.vaultRoot, session.id);
        this.sessions = this.sessions.filter(s => s.id !== session.id);
        this.filteredSessions = this.filteredSessions.filter(s => s.id !== session.id);
        this.rerenderList();
      }
    });

    // Inline rename
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = item.createEl('input', {
        cls: 'cortex-rename-input',
        attr: { value: session.title, type: 'text' },
      });
      titleEl.hide();
      renameBtn.hide();
      deleteBtn.hide();
      input.focus();
      input.select();

      const commit = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== session.title) {
          session.title = newTitle;
          saveSession(this.vaultRoot, session);
          titleEl.setText(newTitle);
        }
        input.remove();
        titleEl.show();
        renameBtn.show();
        deleteBtn.show();
      };

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
        if (ke.key === 'Escape') { input.remove(); titleEl.show(); renameBtn.show(); deleteBtn.show(); }
      });
      input.addEventListener('blur', commit);
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ---------------------------------------------------------------------------
// Chat view
// ---------------------------------------------------------------------------

export class ClaudeView extends ItemView {
  plugin: CortexPlugin;
  private inputEl: HTMLTextAreaElement;
  private messagesEl: HTMLElement;
  private sendBtn: HTMLButtonElement;
  private sessionStatusEl: HTMLElement;
  private currentSessionId: string | undefined;
  private currentSessionTitle: string | undefined;
  private currentSessionCreatedAt: string | undefined;
  private placeholderSessionId: string | undefined; // Track placeholder session ID for updating

  constructor(leaf: WorkspaceLeaf, plugin: CortexPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_CLAUDE; }
  getDisplayText(): string { return 'Cortex'; }
  getIcon(): string { return 'sprout'; }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('cortex-view');

    // Session toolbar
    const toolbar = root.createDiv({ cls: 'cortex-toolbar' });
    this.sessionStatusEl = toolbar.createSpan({ cls: 'cortex-session-status', text: 'New session' });
    this.sessionStatusEl.addEventListener('click', () => this.showSessionHistory());
    this.sessionStatusEl.title = 'Click to see session history';
    const newSessionBtn = toolbar.createEl('button', { text: 'New', cls: 'cortex-new-session' });
    newSessionBtn.addEventListener('click', () => this.startNewSession());

    this.messagesEl = root.createDiv({ cls: 'cortex-messages' });

    const inputRow = root.createDiv({ cls: 'cortex-input-row' });
    this.inputEl = inputRow.createEl('textarea', {
      cls: 'cortex-input',
      attr: { placeholder: 'Ask Claude…', rows: '3' },
    });
    this.sendBtn = inputRow.createEl('button', { text: 'Send', cls: 'cortex-send' });

    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && this.plugin.settings.sendOnEnter) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resume last session if setting is on
    if (this.plugin.settings.resumeLastSession) {
      const vaultRoot = (this.app.vault.adapter as any).basePath;
      const sessions = loadAllSessions(vaultRoot);
      if (sessions.length > 0) {
        await this.loadSession(sessions[0]);
      }
    }
  }

  async onClose() { /* nothing to clean up yet */ }

  startNewSession() {
    const vaultRoot = (this.app.vault.adapter as any).basePath;
    const now = new Date().toISOString();
    const sessionId = now.replace(/[:.]/g, '-');

    // Create and save a placeholder session so it appears in the session manager
    const newSession: StoredSession = {
      id: sessionId,
      title: 'Untitled session',
      createdAt: now,
      updatedAt: now,
      claudeSessionId: '', // Will be populated when first message is sent
    };

    saveSession(vaultRoot, newSession);
    this.placeholderSessionId = sessionId; // Store for updating later
    this.currentSessionId = undefined; // Keep undefined until first message gets real ID
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
      this.loadSession(session);  // fire-and-forget ok here
    }, () => {
      this.startNewSession();
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
      const content = msgEl.textContent || '';
      markdown += `## ${role}\n\n${content}\n\n`;
    });

    // Copy to clipboard
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

    const lastResponse = messages[messages.length - 1];
    const content = lastResponse.textContent || '';

    navigator.clipboard.writeText(content).then(() => {
      new Notice('Last response copied to clipboard');
    }).catch(() => {
      new Notice('Failed to copy to clipboard');
    });

    log('Last response copied to clipboard');
  }

  private async loadSession(session: StoredSession) {
    this.placeholderSessionId = undefined; // Clear placeholder when loading a session
    this.currentSessionId = session.claudeSessionId || undefined; // Treat empty string as undefined
    this.currentSessionTitle = session.title;
    this.currentSessionCreatedAt = session.createdAt;
    this.messagesEl.empty();
    this.updateSessionStatus();

    const isNew = !session.claudeSessionId;
    const resumable = !isNew && canResumeLocally(session.claudeSessionId);

    // If this is a placeholder session (empty claudeSessionId), set up placeholder tracking
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
            await MarkdownRenderer.render(this.app, msg.content, el, '', this);
          }
        }
        // Divider between history and new messages
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

    const unlock = () => { this.sendBtn.disabled = false; };
    const isNewSession = !this.currentSessionId;
    const firstPrompt = isNewSession ? prompt : undefined;
    log('handleSend — session:', this.currentSessionId ?? 'new', '— prompt:', prompt.substring(0, 60));

    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.appendMessage('user', prompt);

    const assistantEl = this.appendMessage('assistant', '');
    assistantEl.addClass('cortex-thinking');

    // On the first message of a new session, prepend vault context
    let finalPrompt = prompt;
    if (isNewSession) {
      const ctx = new ContextManager(
        this.app,
        this.plugin.settings.contextFilePath,
        this.plugin.settings.autonomousMemory,
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
        binaryPath: this.plugin.claudeBinaryPath,
        prompt: finalPrompt,
        vaultRoot: (this.app.vault.adapter as any).basePath,
        env: this.plugin.shellEnv,
        resumeSessionId: this.currentSessionId,
      });
    } catch (e) {
      assistantEl.setText(`Failed to start claude: ${e}`);
      unlock();
      return;
    }

    proc.stdin?.end();

    let accumulated = '';

    parseStreamOutput(proc, {
      onText: (delta) => {
        accumulated += delta;
        assistantEl.setText(accumulated);
      },
      onToolCall: (tool) => {
        this.appendMessage('system', `Tool: ${tool}`);
      },
      onDone: (sessionId) => {
        assistantEl.removeClass('cortex-thinking');

        if (sessionId) {
          const vaultRoot = (this.app.vault.adapter as any).basePath;
          const now = new Date().toISOString();

          if (this.placeholderSessionId) {
            // Update the placeholder session with the real claudeSessionId
            this.currentSessionId = sessionId;
            saveSession(vaultRoot, {
              id: this.placeholderSessionId,
              title: this.currentSessionTitle ?? 'Untitled session',
              createdAt: this.currentSessionCreatedAt ?? now,
              updatedAt: now,
              claudeSessionId: sessionId,
            });
            this.placeholderSessionId = undefined; // Reset for next session
            log('Placeholder session updated:', this.placeholderSessionId, '→', sessionId);
          } else if (isNewSession && firstPrompt) {
            // First response from a "New" in panel without placeholder — create the session record
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
            // Subsequent messages — update the timestamp
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

        if (!accumulated) {
          assistantEl.setText('(no response)');
        } else {
          assistantEl.empty();
          MarkdownRenderer.render(this.app, accumulated, assistantEl, '', this);
        }
        assistantEl.scrollIntoView({ behavior: 'smooth' });
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

  private appendMessage(role: 'user' | 'assistant' | 'system', text: string): HTMLElement {
    const el = this.messagesEl.createDiv({ cls: `cortex-message cortex-${role}` });
    el.setText(text);
    el.scrollIntoView({ behavior: 'smooth' });
    return el;
  }
}
