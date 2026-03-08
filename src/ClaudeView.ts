import { ItemView, WorkspaceLeaf, MarkdownRenderer } from 'obsidian';
import type CortexPlugin from '../main';
import { spawnClaude, parseStreamOutput } from './ClaudeProcess';
import { ContextManager } from './ContextManager';
import { log } from './utils/logger';

export const VIEW_TYPE_CLAUDE = 'cortex-chat';

export class ClaudeView extends ItemView {
  plugin: CortexPlugin;
  private inputEl: HTMLTextAreaElement;
  private messagesEl: HTMLElement;
  private sendBtn: HTMLButtonElement;
  private sessionStatusEl: HTMLElement;
  private currentSessionId: string | undefined;

  constructor(leaf: WorkspaceLeaf, plugin: CortexPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_CLAUDE; }
  getDisplayText(): string { return 'Cortex'; }
  getIcon(): string { return 'message-square'; }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('cortex-view');

    // Session toolbar
    const toolbar = root.createDiv({ cls: 'cortex-toolbar' });
    this.sessionStatusEl = toolbar.createSpan({ cls: 'cortex-session-status', text: 'New session' });
    const newSessionBtn = toolbar.createEl('button', { text: 'New session', cls: 'cortex-new-session' });
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
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  async onClose() { /* nothing to clean up yet */ }

  private startNewSession() {
    this.currentSessionId = undefined;
    this.messagesEl.empty();
    this.updateSessionStatus();
    log('New session started');
  }

  private updateSessionStatus() {
    if (this.currentSessionId) {
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
    log('handleSend — session:', this.currentSessionId ?? 'new', '— prompt:', prompt.substring(0, 60));

    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.appendMessage('user', prompt);

    const assistantEl = this.appendMessage('assistant', '…');

    // On the first message of a new session, prepend vault context
    let finalPrompt = prompt;
    if (isNewSession) {
      const ctx = new ContextManager(this.app, this.plugin.settings.contextFilePath);
      const context = await ctx.buildSessionContext();
      finalPrompt = ctx.injectContext(context, prompt);
      if (context) log('Context injected, length:', context.length);
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

    // Close stdin — claude waits for it before processing
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
        if (sessionId) {
          this.currentSessionId = sessionId;
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
