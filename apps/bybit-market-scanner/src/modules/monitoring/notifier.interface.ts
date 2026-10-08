export interface SignalizerEvent {
  symbol: string;
  fromState?: string | null;
  toState: string;
  observation: Record<string, unknown>;
  transition?: Record<string, unknown>;
}

export interface SignalizerNotifier {
  notify(event: SignalizerEvent): Promise<void> | void;
}
