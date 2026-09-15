export enum BrokerCapability {
  MARKET_DATA = 'market_data',
  ACCOUNT = 'account',
  TRADING = 'trading',
}

export type BrokerCapabilityKey = keyof typeof BrokerCapability;
