export interface SignalizerEvent {
  symbol: string;
  fromState?: string | null;
  toState: string;
  observation: any;
  transition?: any;
}

export interface SignalizerNotifier {
  notify(event: SignalizerEvent): Promise<void> | void;
}
