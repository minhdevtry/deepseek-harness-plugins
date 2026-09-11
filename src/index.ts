/**
 * Cordis Host Plugin Entry Point for @anoslide/dsh-vscode-workspace.
 *
 * Injects webServer and mounts the unified /vscode-files/* workspace backend.
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerHostRoutes } from './host/routes.ts'

export const name = 'dsh-vscode-workspace'
export const inject = ['webServer']

export function apply(ctx: Context): void {
  registerHostRoutes(ctx)
}
