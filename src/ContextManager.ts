import { App } from 'obsidian';
import { buildVaultTree } from './utils/fileTree';
import { log, estimateTokens } from './utils/logger';

export class ContextManager {
  constructor(
    private app: App,
    private contextFilePath: string,
    private autonomousMemory: boolean = true,
  ) { }

  async buildSessionContext(): Promise<string> {
    const parts: string[] = [];
    const layerBreakdown: Record<string, { text: string; chars: number; tokens: number }> = {};

    // Layer 1: Vault tree
    const tree = buildVaultTree(this.app.vault);
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
