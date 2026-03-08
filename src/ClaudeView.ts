import { ItemView, WorkspaceLeaf, MarkdownRenderer } from 'obsidian';
import type CortexPlugin from '../main';
import { spawnClaude, parseStreamOutput } from './ClaudeProcess';
import { log } from './utils/logger';

export const VIEW_TYPE_CLAUDE = 'cortex-chat';

export class ClaudeView extends ItemView {
  plugin: CortexPlugin;
  private inputEl: HTMLTextAreaElement;
  private messagesEl: HTMLElement;
  private sendBtn: HTMLButtonElement;

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

  private handleSend() {
    const prompt = this.inputEl.value.trim();
    if (!prompt) return;

    if (!this.plugin.claudeBinaryPath) {
      this.appendMessage('system', 'Claude binary not found. Check Cortex settings.');
      return;
    }

    const unlock = () => { this.sendBtn.disabled = false; };
    log('handleSend — prompt:', prompt.substring(0, 80));

    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.appendMessage('user', prompt);

    const assistantEl = this.appendMessage('assistant', '…');

    let proc: ReturnType<typeof spawnClaude>;
    try {
      proc = spawnClaude({
        binaryPath: this.plugin.claudeBinaryPath,
        prompt,
        vaultRoot: (this.app.vault.adapter as any).basePath,
        env: this.plugin.shellEnv,
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
        // Plain text while streaming so we don't thrash the DOM
        assistantEl.setText(accumulated);
      },
      onToolCall: (tool) => {
        this.appendMessage('system', `Tool: ${tool}`);
      },
      onDone: () => {
        if (!accumulated) {
          assistantEl.setText('(no response)');
        } else {
          // Render markdown now that the full response is in
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
