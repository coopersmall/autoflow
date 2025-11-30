/**
 * Enum mapping utilities for options data.
 *
 * These pure functions map between our domain types and Polygon API enum types.
 */

import {
  GetOptionsAggregatesTimespanEnum,
  GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum,
  GetOptionsChainContractTypeEnum,
  ListOptionsContractsContractTypeEnum,
} from '@polygon.io/client-js';

export function mapListChainContractType(
  type: 'call' | 'put',
): GetOptionsChainContractTypeEnum {
  switch (type) {
    case 'call':
      return GetOptionsChainContractTypeEnum.Call;
    case 'put':
      return GetOptionsChainContractTypeEnum.Put;
  }
}

export function mapListOptionContractType(
  type: 'call' | 'put',
): ListOptionsContractsContractTypeEnum {
  switch (type) {
    case 'call':
      return ListOptionsContractsContractTypeEnum.Call;
    case 'put':
      return ListOptionsContractsContractTypeEnum.Put;
  }
}

export function mapGetOptionContractType(
  type: GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum,
): 'call' | 'put' | 'other' {
  switch (type) {
    case GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum.Call:
      return 'call';
    case GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum.Put:
      return 'put';
    case GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum.Other:
      return 'other';
  }
}

export function mapTimespan(
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month',
): GetOptionsAggregatesTimespanEnum {
  switch (timespan) {
    case 'minute':
      return GetOptionsAggregatesTimespanEnum.Minute;
    case 'hour':
      return GetOptionsAggregatesTimespanEnum.Hour;
    case 'day':
      return GetOptionsAggregatesTimespanEnum.Day;
    case 'week':
      return GetOptionsAggregatesTimespanEnum.Week;
    case 'month':
      return GetOptionsAggregatesTimespanEnum.Month;
  }
}
