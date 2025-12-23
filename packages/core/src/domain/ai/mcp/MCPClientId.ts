import type zod from 'zod';
import { createIdSchema, newId } from '../../Id';

export type MCPClientId = zod.infer<typeof mcpClientIdSchema>;
export const MCPClientId = newId<MCPClientId>;
export const mcpClientIdSchema = createIdSchema('MCPClientId');
