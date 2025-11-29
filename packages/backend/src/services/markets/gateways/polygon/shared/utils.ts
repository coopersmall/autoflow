export function toNanoSeconds(date: Date): number {
  return date.getTime() * 1_000_000;
}
