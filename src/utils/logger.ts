import { appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';

let logPath = '';

export function initLogger(vaultRoot: string) {
  logPath = join(vaultRoot, '_cortex-debug.log');
  writeFileSync(logPath, `--- Cortex log started ${new Date().toISOString()} ---\n`);
}

function write(level: string, args: unknown[]) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ')}\n`;

  // always echo to devtools console
  if (level === 'WARN') console.warn('[Cortex]', ...args);
  else console.log('[Cortex]', ...args);

  // write to file if initialized
  if (logPath) {
    try { appendFileSync(logPath, line); } catch { /* ignore write errors */ }
  }
}

export const log = (...args: unknown[]) => write('INFO', args);
export const warn = (...args: unknown[]) => write('WARN', args);

/**
 * Rough token estimation (Claude uses ~4 chars per token on average).
 * This is approximate; actual token count from API may differ.
 */
export function estimateTokens(text: string): number {
  // Claude's tokenizer counts roughly 1 token per 4 characters for English text
  // This is a rough approximation used for debugging
  return Math.ceil(text.length / 4);
}
