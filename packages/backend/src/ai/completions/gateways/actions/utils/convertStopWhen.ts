import { type StopWhen, unreachable } from '@autoflow/core';
import { hasToolCall, type StopCondition, stepCountIs, type ToolSet } from 'ai';

export function convertStopWhen(
  stopWhen?: StopWhen[],
): StopCondition<ToolSet>[] {
  if (!stopWhen || stopWhen.length === 0) {
    return [stepCountIs(1)];
  }
  return stopWhen.map((condition) => {
    switch (condition.type) {
      case 'toolUse':
        return hasToolCall(condition.name);
      case 'stepCount':
        return stepCountIs(condition.stepCount);
      default:
        return unreachable(condition);
    }
  });
}
