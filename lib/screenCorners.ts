/**
 * iOS does not expose display corner radius publicly. Home-indicator phones
 * have rounded screens; width * 0.12 matches iPhone 12–16 (≈47–55pt).
 * Devices without a home-indicator inset (SE, older Android, web) report 0.
 */
export function estimateScreenCornerRadius(bottomInset: number, width: number): number {
  if (bottomInset < 20) return 0;
  return Math.round(Math.min(55, Math.max(39, width * 0.12)));
}

/**
 * How far in from the screen edge a view must sit so that at `fromBottom`
 * pixels up, it stays inside a quarter-circle of `radius`.
 */
export function cornerSideInset(radius: number, fromBottom: number): number {
  if (radius <= 0) return 0;
  if (fromBottom >= radius) return 0;
  const t = radius - fromBottom;
  return radius - Math.sqrt(Math.max(0, radius * radius - t * t));
}
