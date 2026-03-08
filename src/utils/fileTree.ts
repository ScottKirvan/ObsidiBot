import { TFolder, TFile, Vault } from 'obsidian';

export function buildVaultTree(vault: Vault, maxDepth = 4): string {
  const lines: string[] = [];

  function walk(folder: TFolder, depth: number) {
    if (depth > maxDepth) return;
    const indent = '  '.repeat(depth);

    // Folders first (skip hidden)
    for (const child of folder.children) {
      if (child instanceof TFolder && !child.name.startsWith('.')) {
        lines.push(`${indent}${child.name}/`);
        walk(child, depth + 1);
      }
    }
    // Then files (skip hidden)
    for (const child of folder.children) {
      if (child instanceof TFile && !child.name.startsWith('.')) {
        lines.push(`${indent}${child.name}`);
      }
    }
  }

  walk(vault.getRoot(), 0);
  return lines.join('\n');
}
