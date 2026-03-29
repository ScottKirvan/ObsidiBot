import { appendFileSync } from 'fs';
import { join } from 'path';

let logPath = '';
let fileEnabled = true;
let verbosity: 'normal' | 'verbose' = 'normal';

export interface LoggerConfig {
  enabled: boolean;
  /** Vault-relative path, e.g. ".obsidian/plugins/cortex/cortex-debug.log" */
  filePath: string;
  verbosity: 'normal' | 'verbose';
}

export function initLogger(vaultRoot: string, config?: LoggerConfig) {
  fileEnabled = config?.enabled ?? true;
  verbosity = config?.verbosity ?? 'normal';

  if (fileEnabled) {
    logPath = join(vaultRoot, config?.filePath ?? '_cortex-debug.log');
    try {
      appendFileSync(logPath, `--- Cortex log started ${new Date().toISOString()} ---\n`);
    } catch { /* ignore */ }
  } else {
    logPath = '';
  }
}

function write(level: string, args: unknown[]) {
  // always echo to devtools console
  if (level === 'WARN') console.warn('[Cortex]', ...args);
  else console.log('[Cortex]', ...args);

  if (!fileEnabled || !logPath) return;

  const line = `[${new Date().toISOString()}] [${level}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ')}\n`;

  try { appendFileSync(logPath, line); } catch { /* ignore write errors */ }
}

export const log  = (...args: unknown[]) => write('INFO', args);
export const warn = (...args: unknown[]) => write('WARN', args);
/** Verbose-only — only written when verbosity is 'verbose'. */
export const logv = (...args: unknown[]) => { if (verbosity === 'verbose') write('INFO', args); };

/**
 * Rough token estimation (Claude uses ~4 chars per token on average).
 * This is approximate; actual token count from API may differ.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
