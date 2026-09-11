/**
 * Global Persona Service for @anoslide/dsh-vscode-workspace.
 *
 * Manages ~/.dsh/global-persona.md and injects the global persona
 * into the systemPrompt section of all DSH chat sessions.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const PERSONA_FILE = join(homedir(), '.dsh', 'global-persona.md')
export const MAX_PERSONA_BYTES = 128 * 1024
export const PERSONA_SECTION = 'user:global-persona'
export const PERSONA_ORDER = 1

/**
 * Reads global persona file asynchronously.
 */
export async function readPersona(): Promise<string> {
  try {
    return await readFile(PERSONA_FILE, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Reads global persona file synchronously with size truncation.
 */
export function readPersonaSync(): string {
  try {
    return readFileSync(PERSONA_FILE, 'utf8').slice(0, MAX_PERSONA_BYTES)
  } catch {
    return ''
  }
}

/**
 * Writes global persona file, validating string content and size.
 */
export async function writePersona(content: string): Promise<void> {
  if (typeof content !== 'string') {
    throw new Error('body needs { content: string }')
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_PERSONA_BYTES) {
    throw new Error('persona too large')
  }
  await writeFile(PERSONA_FILE, content, 'utf8')
}

/**
 * Injects global persona section into Cordis systemPrompt service.
 */
export function registerPersonaPrompt(ctx: any): void {
  try {
    ctx.inject?.(['systemPrompt'], (promptCtx: any) => {
      promptCtx.systemPrompt?.section({
        name: PERSONA_SECTION,
        order: PERSONA_ORDER,
        text: () => readPersonaSync(),
      })
    })
  } catch {
    // Service might not be present in test or minimal environments
  }
}
