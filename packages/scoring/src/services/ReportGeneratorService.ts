import type { AppError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import {
  type CompositeScore,
  type EvidenceExcerpt,
} from '../domain/scores.js';
import {
  ReportId,
  type ReportContext,
  type RiskLevel,
  type RiskReport,
  getRiskLevel,
  reportContextSchema,
} from '../domain/report.js';

// Report generator context
export interface ReportGeneratorContext {
  logger: {
    info: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };
  correlationId: string;
}

// Creates a report generator service
export function createReportGeneratorService() {
  return {
    // Generate a full risk report
    generate(
      context: ReportContext,
      score: CompositeScore,
      ctx: ReportGeneratorContext,
    ): Result<RiskReport, AppError> {
      ctx.logger.info('Generating risk report', {
        overallScore: score.overallScore,
      });

      // Validate context
      const contextResult = reportContextSchema.safeParse(context);
      if (!contextResult.success) {
        return err({
          type: 'bad_request',
          message: 'Invalid report context',
          metadata: { errors: contextResult.error.errors },
        });
      }

      // Calculate duration
      const durationMs =
        new Date(context.sessionEndedAt).getTime() -
        new Date(context.sessionStartedAt).getTime();

      // Determine risk level
      const riskLevel = getRiskLevel(score.overallScore);

      // Generate summary
      const summary = generateReportSummary(score, riskLevel);

      // Generate recommendations
      const recommendations = generateRecommendations(score);

      const report: RiskReport = {
        id: ReportId(),
        schemaVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
        metadata: {
          targetUrl: context.targetUrl,
          targetAgentName: context.targetAgentName,
          sessionStartedAt: context.sessionStartedAt,
          sessionEndedAt: context.sessionEndedAt,
          totalTurns: context.totalTurns,
          totalDurationMs: durationMs,
          scenariosRun: context.scenariosRun,
        },
        score,
        riskLevel,
        summary,
        recommendations,
      };

      ctx.logger.info('Risk report generated', {
        reportId: report.id,
        riskLevel,
        overallScore: score.overallScore,
      });

      return ok(report);
    },
  };
}

// Generate report summary
function generateReportSummary(score: CompositeScore, riskLevel: RiskLevel): string {
  const failedComponents = score.components.filter((c) => !c.passed);
  const passedComponents = score.components.filter((c) => c.passed);

  let summary = `Overall Risk Score: ${score.overallScore}/850 (${riskLevel.toUpperCase()} risk). `;

  if (failedComponents.length === 0) {
    summary += 'All evaluation components passed. The agent demonstrates strong performance across all risk dimensions.';
  } else if (passedComponents.length > failedComponents.length) {
    summary += `${passedComponents.length}/${score.components.length} components passed. `;
    summary += `Areas needing attention: ${failedComponents.map((c) => c.type).join(', ')}.`;
  } else {
    summary += `Critical concerns identified in ${failedComponents.length} of ${score.components.length} evaluation components. `;
    summary += `Immediate attention required for: ${failedComponents.map((c) => c.type).join(', ')}.`;
  }

  return summary;
}

// Generate recommendations based on component scores
function generateRecommendations(score: CompositeScore): string[] {
  const recommendations: string[] = [];

  for (const component of score.components) {
    if (!component.passed) {
      switch (component.type) {
        case 'determinism':
          recommendations.push(
            'Improve response determinism by reducing temperature or implementing response caching for identical prompts.',
          );
          break;
        case 'brandAlignment':
          recommendations.push(
            'Enhance brand alignment by refining system prompts to better match brand voice and tone guidelines.',
          );
          break;
        case 'grounding':
          recommendations.push(
            'Improve factual grounding by integrating with verified knowledge bases and implementing citation requirements.',
          );
          break;
        case 'safety':
          recommendations.push(
            'Strengthen safety guardrails with additional prompt injection detection and PII protection mechanisms.',
          );
          break;
        case 'operationalEfficiency':
          recommendations.push(
            'Optimize operational efficiency by reducing average turn count and improving first-contact resolution rates.',
          );
          break;
      }
    }
  }

  // Add general recommendations if score is low
  if (score.overallScore < 550) {
    recommendations.push(
      'Consider a comprehensive review of the agent\'s configuration and training data.',
    );
  }

  // If all passed, still suggest monitoring
  if (recommendations.length === 0) {
    recommendations.push(
      'Continue monitoring agent performance with regular risk assessments.',
    );
  }

  return recommendations;
}

export type ReportGeneratorService = ReturnType<
  typeof createReportGeneratorService
>;
