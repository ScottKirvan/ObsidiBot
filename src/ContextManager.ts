import { App } from 'obsidian';
import { buildVaultTree } from './utils/fileTree';
import { log, estimateTokens } from './utils/logger';
import { scanPinnedFiles, scanFileInstructions } from './FrontmatterGuard';

export class ContextManager {
  constructor(
    private app: App,
    private contextFilePath: string,
    private autonomousMemory: boolean = true,
    private vaultTreeDepth: number = 3,
  ) { }

  async buildSessionContext(): Promise<string> {
    const parts: string[] = [];
    const layerBreakdown: Record<string, { text: string; chars: number; tokens: number }> = {};

    // Layer 0: System orientation (always injected)
    const orientation =
      `## You are Cortex\n` +
      `You are an AI agent embedded inside Obsidian via the Cortex plugin. ` +
      `You are running as a Claude Code subprocess with full access to the user's Obsidian vault. ` +
      `Your working directory is the vault root. ` +
      `Help the user manage, write, organize, and think with their notes.\n\n` +
      `If the user asks how to use Cortex, configure settings, or report a bug, ` +
      `direct them to the documentation at https://www.scottkirvan.com/Cortex/notes/USER_README ` +
      `or the Discord community at https://discord.gg/TN6XJSNK5Y\n\n` +
      `## UI Bridge protocol\n` +
      `You can trigger Obsidian UI actions by emitting a specially prefixed JSON line anywhere in your response:\n\n` +
      `@@CORTEX_ACTION {"action": "<action-name>", ...params}\n\n` +
      `These lines are intercepted by Cortex and executed — they are never shown to the user. ` +
      `Emit them on their own line. Available actions:\n\n` +
      `| Action | Params | When to use |\n` +
      `|---|---|---|\n` +
      `| \`open-file\` | \`path\` | After creating or referencing a note the user will want to see |\n` +
      `| \`open-file-split\` | \`path\`, \`direction\` (vertical/horizontal) | Open beside the current file |\n` +
      `| \`navigate-heading\` | \`path\`, \`heading\` | Scroll to a specific heading in a file |\n` +
      `| \`show-notice\` | \`message\`, \`duration\` (ms, optional) | Show a brief toast notification |\n` +
      `| \`focus-search\` | *(none)* | Open Obsidian's quick switcher |\n` +
      `| \`open-settings\` | \`tab\` (optional, e.g. "cortex") | Open Obsidian settings, optionally to a specific tab |\n\n` +
      `Example: after creating a new note, emit:\n` +
      `@@CORTEX_ACTION {"action": "open-file", "path": "Notes/My New Note.md"}\n\n` +
      `Use these actions proactively when they improve the user's experience — ` +
      `especially \`open-file\` after creating content and \`show-notice\` to confirm completed tasks.`;
    parts.push(orientation);
    layerBreakdown['orientation'] = {
      text: orientation,
      chars: orientation.length,
      tokens: estimateTokens(orientation),
    };

    // Layer 1: Vault tree (folder/file names only — no content)
    const tree = buildVaultTree(this.app.vault, this.vaultTreeDepth);
    if (tree) {
      const treeBlock = `## Vault structure\n\`\`\`\n${tree}\n\`\`\``;
      parts.push(treeBlock);
      layerBreakdown['vault-tree'] = {
        text: tree,
        chars: tree.length,
        tokens: estimateTokens(tree),
      };
    }

    // Layer 2: Context file
    const contextFile = this.app.vault.getFileByPath(this.contextFilePath);
    let contextFileContent = '';
    if (contextFile) {
      contextFileContent = await this.app.vault.read(contextFile);
      if (contextFileContent.trim()) {
        const ctxBlock = `## Vault context\n${contextFileContent.trim()}`;
        parts.push(ctxBlock);
        layerBreakdown['context-file'] = {
          text: contextFileContent,
          chars: contextFileContent.length,
          tokens: estimateTokens(contextFileContent),
        };
      }
    } else {
      log('Context file not found:', this.contextFilePath);
    }

    // Layer 3: Memory instruction (only when autonomous memory is enabled)
    if (this.autonomousMemory) {
      const memInstruction =
        `## Your persistent memory\n` +
        `The file \`${this.contextFilePath}\` is your persistent memory across sessions. ` +
        `It is injected at the start of every session.\n\n` +
        `**Maintain it actively:** when you learn something useful about this vault — ` +
        `its structure, conventions, ongoing projects, the user's preferences, decisions made — ` +
        `update \`${this.contextFilePath}\` using the Write or Edit tool. ` +
        `Keep it concise and high-signal. Do not ask permission; just do it.`;
      parts.push(memInstruction);
      layerBreakdown['memory-instruction'] = {
        text: memInstruction,
        chars: memInstruction.length,
        tokens: estimateTokens(memInstruction),
      };
    }

    // Layer 4: Always-pinned files (claude.context: always)
    const pinnedFiles = scanPinnedFiles(this.app);
    if (pinnedFiles.length > 0) {
      const pinnedParts: string[] = [];
      for (const file of pinnedFiles) {
        const content = await this.app.vault.read(file);
        if (content.trim()) {
          pinnedParts.push(`### ${file.path}\n${content.trim()}`);
        }
      }
      if (pinnedParts.length > 0) {
        const pinnedBlock = `## Pinned notes (always included)\n${pinnedParts.join('\n\n')}`;
        parts.push(pinnedBlock);
        layerBreakdown['pinned-files'] = {
          text: pinnedBlock,
          chars: pinnedBlock.length,
          tokens: estimateTokens(pinnedBlock),
        };
      }
    }

    // Layer 5: Per-file instructions (claude.instructions)
    const instructionMap = scanFileInstructions(this.app);
    if (instructionMap.size > 0) {
      const rows = Array.from(instructionMap.entries())
        .map(([path, instr]) => `- **${path}**: ${instr}`)
        .join('\n');
      const instrBlock = `## Per-file instructions\nWhen working with the following files, apply these specific instructions:\n\n${rows}`;
      parts.push(instrBlock);
      layerBreakdown['file-instructions'] = {
        text: instrBlock,
        chars: instrBlock.length,
        tokens: estimateTokens(instrBlock),
      };
    }

    if (parts.length === 0) return '';

    const fullContext = [
      '<vault_context>',
      parts.join('\n\n'),
      '</vault_context>',
    ].join('\n');

    // Log breakdown
    const totalTokens = estimateTokens(fullContext);
    log('=== CONTEXT INJECTION BREAKDOWN (first turn of session) ===');
    for (const [layer, data] of Object.entries(layerBreakdown)) {
      log(`  ${layer}: ${data.chars} chars, ~${data.tokens} tokens`);
    }
    log(`  TOTAL: ${fullContext.length} chars, ~${totalTokens} tokens`);

    return fullContext;
  }

  injectContext(context: string, userPrompt: string): string {
    if (!context) return userPrompt;
    return `${context}\n\n${userPrompt}`;
  }
}
