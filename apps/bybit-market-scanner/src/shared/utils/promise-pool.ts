export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const result: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) {
        throw new Error(`Missing item at index ${index}`);
      }
      result[index] = await mapper(item, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(safeConcurrency, items.length) }, () => worker()));
  return result;
}
