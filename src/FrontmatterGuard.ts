import { App, TFile } from 'obsidian';

function getFM(app: App, file: TFile): Record<string, unknown> | null {
  return app.metadataCache.getFileCache(file)?.frontmatter ?? null;
}

/** Returns all markdown files with `cortex-context: always` in their frontmatter. */
export function scanPinnedFiles(app: App): TFile[] {
  return app.vault.getMarkdownFiles().filter(f => getFM(app, f)?.['cortex-context'] === 'always');
}

/** Returns a map of file path → instruction string for all files with `cortex-instructions`. */
export function scanFileInstructions(app: App): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const instr = getFM(app, file)?.['cortex-instructions'];
    if (typeof instr === 'string' && instr.trim()) map.set(file.path, instr.trim());
  }
  return map;
}
