import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice } from 'obsidian';
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
} from './utils/sessionStorage';
import { SessionListModal } from './modals/SessionListModal';
import { ContextGenerationModal } from './ContextGenerationModal';

export const VIEW_TYPE_CLAUDE = 'cortex-chat';

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
      attr: { placeholder: 'Ask Cortex…', rows: '3' },
    });
    this.sendBtn = inputRow.createEl('button', { text: 'Send', cls: 'cortex-send' });

    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.inputEl.addEventListener('keydown', (e) => {
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
      this.plugin.claudeBinaryPath &&
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

    const unlock = () => { this.sendBtn.disabled = false; };
    const isNewSession = !this.currentSessionId;
    const firstPrompt = isNewSession ? prompt : undefined;
    log('handleSend — session:', this.currentSessionId ?? 'new', '— prompt:', prompt.substring(0, 60));

    this.inputHistory.push(prompt);
    this.historyIndex = -1;
    this.inputDraft = '';
    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.appendMessage('user', prompt);

    const assistantEl = this.appendMessage('assistant', '');
    const statusEl = assistantEl.createSpan({ cls: 'cortex-status', text: 'Thinking…' });

    let finalPrompt = prompt;
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

    const toolLabels: Record<string, string> = {
      read_file:    'Reading…',
      write_file:   'Writing…',
      edit_file:    'Editing…',
      list_files:   'Scanning vault…',
      search_files: 'Searching…',
      bash:         'Running command…',
      web_fetch:    'Fetching…',
      web_search:   'Searching the web…',
    };

    let accumulated = '';

    parseStreamOutput(proc, {
      onText: (delta) => {
        statusEl.remove();
        accumulated += delta;
        assistantEl.setText(accumulated);
      },
      onToolCall: (tool) => {
        statusEl.setText(toolLabels[tool] ?? 'Working…');
        this.appendMessage('system', `Tool: ${tool}`);
      },
      onDone: (sessionId) => {
        statusEl.remove();

        if (sessionId) {
          const vaultRoot = (this.app.vault.adapter as any).basePath;
          const now = new Date().toISOString();

          if (this.placeholderSessionId) {
            this.currentSessionId = sessionId;
            saveSession(vaultRoot, {
              id: this.placeholderSessionId,
              title: this.currentSessionTitle ?? 'Untitled session',
              createdAt: this.currentSessionCreatedAt ?? now,
              updatedAt: now,
              claudeSessionId: sessionId,
            });
            this.placeholderSessionId = undefined;
            log('Placeholder session updated:', this.placeholderSessionId, '→', sessionId);
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

        if (!accumulated) {
          assistantEl.setText('(no response)');
        } else {
          assistantEl.dataset.markdown = accumulated;
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
