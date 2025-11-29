export const contractTypes = ['call', 'put', 'other'] as const;
export type ContractType = (typeof contractTypes)[number];

export const exerciseStyles = ['american', 'european', 'bermudan'] as const;
export type ExerciseStyle = (typeof exerciseStyles)[number];

export interface OptionsContract {
  ticker: string;
  underlying: string;
  contractType: ContractType;
  expirationDate: string;
  strikePrice: number;
  sharesPerContract: number;
  exerciseStyle?: ExerciseStyle;
  cfi?: string;
}

export interface OptionsQuote {
  ticker: string;
  bidPrice?: number;
  bidSize?: number;
  askPrice?: number;
  askSize?: number;
  timestamp: number;
}

export interface OptionsTrade {
  ticker: string;
  price: number;
  size: number;
  timestamp: number;
}

export interface OptionsAggregate {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  vwap?: number;
  transactions?: number;
}

export interface OptionsChainContract {
  ticker: string;
  underlying: string;
  contractType: ContractType;
  expirationDate: string;
  strikePrice: number;
  exerciseStyle: ExerciseStyle;
  sharesPerContract: number;
  breakEvenPrice?: number;

  day?: {
    change: number;
    changePercent: number;
    close: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    volume: number;
  };

  lastQuote?: {
    ask: number;
    askSize: number;
    askExchange?: number;
    bid: number;
    bidSize: number;
    bidExchange?: number;
    timestamp: number;
  };

  lastTrade?: {
    price: number;
    size: number;
    conditions?: number[];
    exchange: number;
    timestamp: number;
  };
}

export interface OptionsChain {
  underlying: string;
  contracts: OptionsChainContract[];
}
