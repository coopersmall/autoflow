export interface StockDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primaryExchange?: string;
  type?: string;
  active: boolean;
  currencyName: string;
  cik?: string;
  compositeFigi?: string;
  shareClassFigi?: string;
}

export interface StockQuote {
  ticker: string;
  bidPrice?: number;
  bidSize?: number;
  askPrice?: number;
  askSize?: number;
  timestamp: number;
}

export interface StockTrade {
  ticker: string;
  price: number;
  size?: number;
  timestamp: number;
  conditions?: number[];
  exchange?: number;
}
