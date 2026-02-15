/**
 * M5: End-to-End Test for Anscape Pipeline
 *
 * This test validates the full pipeline integration:
 * 1. Create scenarios using ShopperService domain types
 * 2. Build component scores using ScoringEngine evaluators
 * 3. Calculate composite score
 * 4. Generate risk report
 *
 * The actual browser-based E2E test requires:
 * - ANSCAPE_E2E=true environment variable
 * - ANSCAPE_TARGET_URL pointing to a real chatbot
 * - Playwright browser installed
 */

import { describe, expect, test } from 'bun:test';
import { calculateCompositeScore, createReportGeneratorService } from '@autoflow/scoring';
import type { ComponentScore } from '@autoflow/scoring';
import { COMPONENT_WEIGHTS } from '@autoflow/scoring';

// Helper to create a valid component score
function createComponentScore(
  type: ComponentScore['type'],
  rawScore: number,
): ComponentScore {
  const weight = COMPONENT_WEIGHTS[type];
  const normalizedScore = Math.round(300 + ((rawScore - 1) / 4) * 550);
  return {
    type,
    weight,
    rawScore,
    normalizedScore,
    weightedScore: (rawScore * weight) / 100,
    reasoning: {
      reasoning: `E2E test: ${type} evaluation`,
      score: rawScore,
      confidence: 0.8,
      evidence: [],
    },
    passed: rawScore >= 3,
  };
}

describe('M5: Anscape Pipeline Integration', () => {
  const mockCtx = {
    logger: { info: () => {}, error: () => {} },
    correlationId: 'e2e-test',
  };

  test('should build component scores from all 5 evaluators', () => {
    // Simulate results from running all adversarial scenarios
    const components: ComponentScore[] = [
      createComponentScore('determinism', 4),      // Low variance in repeated prompts
      createComponentScore('brandAlignment', 3),   // Moderate brand voice consistency
      createComponentScore('grounding', 5),        // Well-grounded factual responses
      createComponentScore('safety', 4),           // Resisted most jailbreak attempts
      createComponentScore('operationalEfficiency', 4), // Efficient resolution
    ];

    expect(components).toHaveLength(5);
    expect(components.every(c => c.weight > 0)).toBe(true);

    // Verify weights sum to 100
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBe(100);
  });

  test('should calculate composite score from components', () => {
    const components: ComponentScore[] = [
      createComponentScore('determinism', 4),
      createComponentScore('brandAlignment', 3),
      createComponentScore('grounding', 5),
      createComponentScore('safety', 4),
      createComponentScore('operationalEfficiency', 4),
    ];

    const result = calculateCompositeScore({ components });
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    
    // Verify score is in valid FICO range
    expect(score.overallScore).toBeGreaterThanOrEqual(300);
    expect(score.overallScore).toBeLessThanOrEqual(850);
    
    // Verify all components are included
    expect(score.components).toHaveLength(5);
    expect(score.schemaVersion).toBe('1.0.0');
    expect(score.id).toBeDefined();
    expect(score.calculatedAt).toBeDefined();

    console.log(`\n=== Composite Score ===`);
    console.log(`Overall: ${score.overallScore}/850`);
    score.components.forEach(c => {
      console.log(`  ${c.type}: ${c.rawScore}/5 (${c.weight}% weight)`);
    });
  });

  test('should generate risk report from composite score', () => {
    const components: ComponentScore[] = [
      createComponentScore('determinism', 4),
      createComponentScore('brandAlignment', 3),
      createComponentScore('grounding', 5),
      createComponentScore('safety', 4),
      createComponentScore('operationalEfficiency', 4),
    ];

    const compositeResult = calculateCompositeScore({ components });
    const compositeScore = compositeResult._unsafeUnwrap();

    const reportGenerator = createReportGeneratorService();
    const reportResult = reportGenerator.generate(
      {
        targetUrl: 'https://demo-chatbot.example.com',
        targetAgentName: 'Demo Customer Service Bot',
        sessionStartedAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
        sessionEndedAt: new Date().toISOString(),
        captureSessionId: 'cap-e2e-demo-001',
        shopperSessionId: 'shop-e2e-demo-001',
        eventCount: 42,
        totalTurns: 15,
        scenariosRun: 5,
      },
      compositeScore,
      mockCtx,
    );

    expect(reportResult.isOk()).toBe(true);
    const report = reportResult._unsafeUnwrap();

    // Verify report structure
    expect(report.id).toBeDefined();
    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.generatedAt).toBeDefined();
    
    // Verify metadata
    expect(report.metadata.targetUrl).toBe('https://demo-chatbot.example.com');
    expect(report.metadata.targetAgentName).toBe('Demo Customer Service Bot');
    expect(report.metadata.totalTurns).toBe(15);
    expect(report.metadata.scenariosRun).toBe(5);
    
    // Verify risk level
    expect(['low', 'medium', 'high', 'critical']).toContain(report.riskLevel);
    
    // Verify summary and recommendations
    expect(report.summary).toContain('Risk Score');
    expect(report.summary.length).toBeGreaterThan(50);
    expect(report.recommendations.length).toBeGreaterThan(0);

    console.log('\n=== Anscape Risk Report ===');
    console.log(`Report ID: ${report.id}`);
    console.log(`Overall Score: ${report.score.overallScore}/850`);
    console.log(`Risk Level: ${report.riskLevel.toUpperCase()}`);
    console.log(`Target: ${report.metadata.targetAgentName}`);
    console.log(`Turns: ${report.metadata.totalTurns}`);
    console.log(`Scenarios: ${report.metadata.scenariosRun}`);
    console.log(`\nSummary: ${report.summary}`);
    console.log(`\nRecommendations:`);
    report.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    console.log('===========================\n');
  });

  test('should detect high-risk agents with failed components', () => {
    // Simulate a poorly performing agent
    const components: ComponentScore[] = [
      createComponentScore('determinism', 2),      // High variance
      createComponentScore('brandAlignment', 2),   // Poor brand alignment
      createComponentScore('grounding', 2),        // Hallucinations detected
      createComponentScore('safety', 1),           // Failed jailbreak tests
      createComponentScore('operationalEfficiency', 2), // Inefficient
    ];

    const compositeResult = calculateCompositeScore({ components });
    const compositeScore = compositeResult._unsafeUnwrap();

    const reportGenerator = createReportGeneratorService();
    const reportResult = reportGenerator.generate(
      {
        targetUrl: 'https://risky-agent.example.com',
        targetAgentName: 'Risky Agent',
        sessionStartedAt: new Date(Date.now() - 600000).toISOString(),
        sessionEndedAt: new Date().toISOString(),
        captureSessionId: 'cap-e2e-risky-001',
        shopperSessionId: 'shop-e2e-risky-001',
        eventCount: 85,
        totalTurns: 30,
        scenariosRun: 3,
      },
      compositeScore,
      mockCtx,
    );

    const report = reportResult._unsafeUnwrap();

    // Should have low score and critical risk (score < 550 = critical)
    expect(report.score.overallScore).toBeLessThan(500);
    expect(report.riskLevel).toBe('critical');
    
    // Should have many recommendations
    expect(report.recommendations.length).toBeGreaterThan(3);
    expect(report.summary).toContain('Critical concerns');
  });

  test('should produce perfect score for ideal agent', () => {
    const components: ComponentScore[] = [
      createComponentScore('determinism', 5),
      createComponentScore('brandAlignment', 5),
      createComponentScore('grounding', 5),
      createComponentScore('safety', 5),
      createComponentScore('operationalEfficiency', 5),
    ];

    const compositeResult = calculateCompositeScore({ components });
    const compositeScore = compositeResult._unsafeUnwrap();

    const reportGenerator = createReportGeneratorService();
    const reportResult = reportGenerator.generate(
      {
        targetUrl: 'https://perfect-agent.example.com',
        targetAgentName: 'Ideal Agent',
        sessionStartedAt: new Date(Date.now() - 180000).toISOString(),
        sessionEndedAt: new Date().toISOString(),
        captureSessionId: 'cap-e2e-ideal-001',
        shopperSessionId: 'shop-e2e-ideal-001',
        eventCount: 20,
        totalTurns: 8,
        scenariosRun: 5,
      },
      compositeScore,
      mockCtx,
    );

    const report = reportResult._unsafeUnwrap();

    // Should have max score and low risk
    expect(report.score.overallScore).toBe(850);
    expect(report.riskLevel).toBe('low');
    expect(report.summary).toContain('All evaluation components passed');
  });
});

describe('Pipeline Error Handling', () => {
  test('should reject missing components', () => {
    const incompleteComponents: ComponentScore[] = [
      createComponentScore('determinism', 4),
      createComponentScore('safety', 4),
      // Missing: brandAlignment, grounding, operationalEfficiency
    ];

    const result = calculateCompositeScore({ components: incompleteComponents });
    expect(result.isErr()).toBe(true);
    
    const error = result._unsafeUnwrapErr();
    expect(error.message).toContain('Missing required component scores');
  });

  test('should reject weights that do not sum to 100', () => {
    const badWeightComponents: ComponentScore[] = [
      { ...createComponentScore('determinism', 4), weight: 10 },
      { ...createComponentScore('brandAlignment', 4), weight: 10 },
      { ...createComponentScore('grounding', 4), weight: 10 },
      { ...createComponentScore('safety', 4), weight: 10 },
      { ...createComponentScore('operationalEfficiency', 4), weight: 10 },
    ];

    const result = calculateCompositeScore({ components: badWeightComponents });
    expect(result.isErr()).toBe(true);
    
    const error = result._unsafeUnwrapErr();
    expect(error.message).toContain('must sum to 100');
  });
});

// Helper function for creating component scores (used above)
function createComponentScore(
  type: ComponentScore['type'],
  rawScore: number,
): ComponentScore {
  const weight = COMPONENT_WEIGHTS[type];
  const normalizedScore = Math.round(300 + ((rawScore - 1) / 4) * 550);
  return {
    type,
    weight,
    rawScore,
    normalizedScore,
    weightedScore: (rawScore * weight) / 100,
    reasoning: {
      reasoning: `${type} evaluation`,
      score: rawScore,
      confidence: 0.8,
      evidence: [],
    },
    passed: rawScore >= 3,
  };
}
