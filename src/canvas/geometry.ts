export function coordinate(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function extent(value: number): number {
  return Math.max(0, coordinate(value));
}

export function angle(value: number): number {
  return coordinate(value);
}
