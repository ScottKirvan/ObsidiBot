import { App, Modal, Notice } from 'obsidian';
import type CortexPlugin from '../main';
import { spawnClaude, parseStreamOutput } from './ClaudeProcess';
import { buildVaultTree } from './utils/fileTree';
import { log } from './utils/logger';

export class ContextGenerationModal extends Modal {
  private plugin: CortexPlugin;
  private contextFilePath: string;
  private binaryPath: string;
  private vaultRoot: string;
  private env: Record<string, string>;
  private vaultTreeDepth: number;

  constructor(
    app: App,
    plugin: CortexPlugin,
    contextFilePath: string,
    binaryPath: string,
    vaultRoot: string,
    env: Record<string, string>,
    vaultTreeDepth: number,
  ) {
    super(app);
    this.plugin = plugin;
    this.contextFilePath = contextFilePath;
    this.binaryPath = binaryPath;
    this.vaultRoot = vaultRoot;
    this.env = env;
    this.vaultTreeDepth = vaultTreeDepth;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Set up your context file' });
    contentEl.createEl('p', {
      text: `No context file was found at "${this.contextFilePath}". ` +
        'This file gives Claude persistent memory of your vault across sessions. ' +
        'You can have Claude generate one from your vault structure, start with a blank template, or skip for now.',
    });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    const generateBtn = btnRow.createEl('button', {
      text: 'Generate with Claude',
      cls: 'mod-cta',
    });
    generateBtn.addEventListener('click', () => {
      this.close();
      this.generateContextFile();
    });

    const blankBtn = btnRow.createEl('button', { text: 'Create blank template' });
    blankBtn.addEventListener('click', () => {
      this.close();
      this.createBlankTemplate();
    });

    const skipBtn = btnRow.createEl('button', { text: 'Skip' });
    skipBtn.addEventListener('click', async () => {
      this.plugin.settings.skipContextFilePrompt = true;
      await this.plugin.saveSettings();
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }

  private async generateContextFile() {
    new Notice('Cortex: generating context file in the background…');
    log('ContextGenerationModal: spawning background generation');

    const tree = buildVaultTree(this.app.vault, this.vaultTreeDepth);
    const treeSection = tree
      ? `Here is the current vault structure (folder and file names only — no file contents):\n\`\`\`\n${tree}\n\`\`\``
      : 'The vault structure is not available — please explore with your file tools.';

    const prompt = [
      `You are setting up a context file for a new Cortex (Obsidian plugin) user.`,
      ``,
      `${treeSection}`,
      ``,
      `Please create the file \`${this.contextFilePath}\` in the vault root.`,
      `This file will be injected at the start of every Cortex session as your persistent memory.`,
      ``,
      `Generate a concise, useful context file (aim for under 300 words) that includes:`,
      `- A brief summary of the vault's organisation based on the folder structure`,
      `- Inferred naming conventions and folder purposes`,
      `- Any obvious ongoing projects or focus areas you can detect from folder/file names`,
      `- A short "## Notes for Claude" section with placeholder text the user can customise`,
      ``,
      `Write the file now using your file tools. Do not ask for confirmation — just create it.`,
    ].join('\n');

    const proc = spawnClaude({
      binaryPath: this.binaryPath,
      prompt,
      vaultRoot: this.vaultRoot,
      env: this.env,
    });

    parseStreamOutput(proc, {
      onText: () => { /* background — discard streaming text */ },
      onAction: () => { /* background — discard UI actions */ },
      onToolCall: (tool) => { log('ContextGenerationModal: tool call:', tool); },
      onPermissionDenied: () => { /* background generation — denials not surfaced */ },
      onDone: () => {
        const exists = this.app.vault.getFileByPath(this.contextFilePath);
        if (exists) {
          new Notice(`Cortex: context file created at "${this.contextFilePath}". Open it in Obsidian to review and edit.`);
        } else {
          new Notice(`Cortex: generation finished but "${this.contextFilePath}" was not found. You may need to create it manually.`);
        }
      },
      onError: (err) => {
        log('ContextGenerationModal: error:', err);
        new Notice('Cortex: context file generation encountered an error. Check the debug log.');
      },
    });
  }

  private async createBlankTemplate() {
    const stub = [
      '# Vault Context',
      '',
      'This file is injected at the start of every Cortex session as Claude\'s persistent memory.',
      'Edit it freely — add conventions, ongoing projects, folder explanations, or anything useful.',
      '',
      '## Conventions',
      '<!-- e.g. Meeting notes go in 02_Calendar/YYYY-MM-DD format -->',
      '',
      '## Current focus',
      '<!-- e.g. Working on Q2 planning. Key notes: [[Goals]], [[Team Roster]] -->',
      '',
      '## Notes for Claude',
      '<!-- e.g. Prefer concise bullet-point summaries. Always ask before deleting files. -->',
    ].join('\n');

    try {
      await this.app.vault.create(this.contextFilePath, stub);
      new Notice(`Cortex: created blank context file at "${this.contextFilePath}".`);
    } catch (err) {
      log('ContextGenerationModal: failed to create blank template:', err);
      new Notice('Cortex: failed to create context file. Check the debug log.');
    }
  }
}
