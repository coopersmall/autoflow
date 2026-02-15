import zod from 'zod';
import { compositeScoreSchema } from './scores.js';
import { reportIdSchema } from './ids.js';

// Risk level based on FICO-style score
export const RiskLevel = zod.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = zod.infer<typeof RiskLevel>;

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 750) return 'low';
  if (score >= 650) return 'medium';
  if (score >= 550) return 'high';
  return 'critical';
}

// Session metadata for the report
export const sessionMetadataSchema = zod.object({
  targetUrl: zod.string().url(),
  targetAgentName: zod.string().optional(),
  sessionStartedAt: zod.string().datetime(),
  sessionEndedAt: zod.string().datetime(),
  totalTurns: zod.number().int().min(0),
  totalDurationMs: zod.number().int().min(0),
  scenariosRun: zod.number().int().min(0),
});

export type SessionMetadata = zod.infer<typeof sessionMetadataSchema>;

// Full risk report
export const riskReportSchema = zod.object({
  id: reportIdSchema,
  schemaVersion: zod.literal('1.0.0'),
  generatedAt: zod.string().datetime(),
  metadata: sessionMetadataSchema,
  score: compositeScoreSchema,
  riskLevel: RiskLevel,
  summary: zod.string().min(1),
  recommendations: zod.array(zod.string()),
});

export type RiskReport = zod.infer<typeof riskReportSchema>;

// Report generation context
export const reportContextSchema = zod.object({
  targetUrl: zod.string().url(),
  targetAgentName: zod.string().optional(),
  sessionStartedAt: zod.string().datetime(),
  sessionEndedAt: zod.string().datetime(),
  captureSessionId: zod.string().min(1),
  shopperSessionId: zod.string().min(1),
  eventCount: zod.number().int().min(0),
  totalTurns: zod.number().int().min(0),
  scenariosRun: zod.number().int().min(0),
});

export type ReportContext = zod.infer<typeof reportContextSchema>;
