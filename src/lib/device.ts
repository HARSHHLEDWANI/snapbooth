/** Device capability + preference helpers used for the lite-mode fallback. */

export function supportsWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/**
 * Heuristic: should we default to the 2D "lite" booth instead of full 3D?
 * We never *block* 3D — this just picks a sensible default the user can override.
 */
export function shouldSuggestLite(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!supportsWebGL()) return true;

  // deviceMemory is only exposed in Chromium; treat <=4GB as constrained.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem <= 4) return true;

  const cores = navigator.hardwareConcurrency ?? 8;
  if (cores <= 4) return true;

  return false;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
