export interface Indicator<TInput, TOutput> {
  readonly name: string;

  calculate(input: TInput): TOutput;
}
