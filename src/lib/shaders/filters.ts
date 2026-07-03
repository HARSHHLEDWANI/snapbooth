/**
 * filters.ts — the entire live-filter look system in one parametric shader.
 *
 * Design decision: rather than 12 separate GLSL programs (which would force a
 * program swap — and a pipeline stall — every time the user cycles filters), we
 * compile ONE fragment shader that branches on an integer `uFilter` uniform.
 * Switching a filter is then just `gl.uniform1i(...)`, never a recompile.
 *
 * The same shader powers three surfaces so a captured still is byte-for-byte the
 * same look as the live preview:
 *   1. live preview canvas (booth mirror texture / mobile fullscreen)
 *   2. full-resolution offscreen capture
 *   3. edit-screen re-render (per-shot filter override + adjust sliders)
 */

export type FilterId =
  | 'original'
  | 'film'
  | 'mono'
  | 'retro'
  | 'cool'
  | 'peach'
  | 'vhs'
  | 'halation'
  | 'pop'
  | 'noir'
  | 'fisheye'
  | 'mirror';

export interface FilterMeta {
  id: FilterId;
  label: string;
  /** integer passed to the shader's uFilter uniform */
  index: number;
}

/** Order is intentional: the signature "peach" sits early, dramatic looks later. */
export const FILTERS: FilterMeta[] = [
  { id: 'original', label: 'original', index: 0 },
  { id: 'film', label: 'film', index: 1 },
  { id: 'peach', label: 'peach', index: 5 },
  { id: 'mono', label: 'mono', index: 2 },
  { id: 'retro', label: 'retro', index: 3 },
  { id: 'cool', label: 'cool', index: 4 },
  { id: 'vhs', label: 'vhs', index: 6 },
  { id: 'halation', label: 'halation', index: 7 },
  { id: 'pop', label: 'pop', index: 8 },
  { id: 'noir', label: 'noir', index: 9 },
  { id: 'fisheye', label: 'fisheye', index: 10 },
  { id: 'mirror', label: 'mirror', index: 11 },
];

export const filterIndex = (id: FilterId): number =>
  FILTERS.find((f) => f.id === id)?.index ?? 0;

/** Default adjust state (edit-screen sliders). All neutral = identity. */
export interface AdjustState {
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  warmth: number; // -1..1
  grain: number; // 0..1
}
export const NEUTRAL_ADJUST: AdjustState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  grain: 0,
};

// A simple full-screen-quad vertex shader. We flip V so the video (which WebGL
// samples bottom-up) appears upright, and optionally flip U for the mirror-selfie.
export const VERTEX_SHADER = /* glsl */ `
  attribute vec2 aPosition;
  varying vec2 vUv;
  uniform float uFlipX; // 1.0 = mirrored selfie, 0.0 = as-shot
  void main() {
    // aPosition is a [-1,1] quad. Map to UV [0,1], flipping V for video origin.
    vec2 uv = aPosition * 0.5 + 0.5;
    uv.y = 1.0 - uv.y;
    if (uFlipX > 0.5) uv.x = 1.0 - uv.x;
    vUv = uv;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2  uResolution;
  uniform float uTime;
  uniform int   uFilter;

  // shared "adjust" pass (edit sliders + subtle live defaults)
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uWarmth;
  uniform float uGrain;

  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

  // ---- helpers -------------------------------------------------------------

  // cheap hash noise for film grain / dust
  float hash(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  vec3 saturate3(vec3 c) { return clamp(c, 0.0, 1.0); }

  vec3 adjustSaturation(vec3 c, float s) {
    float l = dot(c, LUMA);
    return mix(vec3(l), c, 1.0 + s);
  }

  vec3 adjustContrast(vec3 c, float amt) {
    return (c - 0.5) * (1.0 + amt) + 0.5;
  }

  // warm/cool white-balance shift
  vec3 warmShift(vec3 c, float w) {
    c.r += w * 0.10;
    c.b -= w * 0.10;
    return c;
  }

  float vignette(vec2 uv, float strength, float radius) {
    vec2 d = uv - 0.5;
    float v = smoothstep(radius, radius - 0.45, length(d));
    return mix(1.0, v, strength);
  }

  // sample with subtle barrel distortion (fisheye)
  vec2 barrel(vec2 uv, float amount) {
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    c *= 1.0 + amount * r2;
    return c + 0.5;
  }

  // ---- filter looks --------------------------------------------------------

  vec3 lookFilm(vec3 c) {
    // warm tone curve + gentle fade (lift blacks)
    c = pow(c, vec3(0.92));
    c = warmShift(c, 0.35);
    c = mix(c, c + 0.04, 0.6);          // lifted blacks / fade
    c = adjustContrast(c, 0.05);
    return c;
  }

  vec3 lookMono(vec3 c) {
    float l = dot(c, LUMA);
    l = adjustContrast(vec3(l), 0.08).r;
    return vec3(l);
  }

  vec3 lookRetro(vec2 uv, vec3 c) {
    c = warmShift(c, 0.45);
    c = mix(c, vec3(dot(c, LUMA)), 0.15); // slight desat
    c += 0.05;                             // faded
    c *= vignette(uv, 0.5, 0.9);
    return c;
  }

  vec3 lookCool(vec3 c) {
    c = warmShift(c, -0.35);
    c = adjustContrast(c, 0.12);
    c = adjustSaturation(c, 0.05);
    return c;
  }

  vec3 lookPeach(vec2 uv, vec3 c) {
    // signature pastel glow: soft pink lift in highlights, creamy shadows
    c = warmShift(c, 0.22);
    c = adjustSaturation(c, -0.08);
    vec3 peach = vec3(1.0, 0.85, 0.86);
    float hi = smoothstep(0.5, 1.0, dot(c, LUMA));
    c = mix(c, c * peach + 0.03, 0.55 * hi + 0.2);
    c = mix(c, c + 0.05, 0.4);            // airy
    c *= vignette(uv, 0.18, 1.1);
    return c;
  }

  vec3 lookHalation(vec2 uv, vec3 c) {
    // bloom the bright areas by sampling a few offset taps
    float l = dot(c, LUMA);
    vec3 glow = vec3(0.0);
    float step = 2.5 / uResolution.x;
    for (int i = 1; i <= 4; i++) {
      float o = float(i) * step * 3.0;
      glow += texture2D(uTexture, vUv + vec2(o, 0.0)).rgb;
      glow += texture2D(uTexture, vUv - vec2(o, 0.0)).rgb;
      glow += texture2D(uTexture, vUv + vec2(0.0, o)).rgb;
      glow += texture2D(uTexture, vUv - vec2(0.0, o)).rgb;
    }
    glow /= 16.0;
    float hi = smoothstep(0.55, 1.0, l);
    c += glow * hi * 0.6 * vec3(1.0, 0.6, 0.55); // warm halation tint
    c = adjustContrast(c, -0.04);
    return c;
  }

  vec3 lookPop(vec3 c) {
    c = adjustSaturation(c, 0.55);
    c = adjustContrast(c, 0.35);
    return c;
  }

  vec3 lookNoir(vec2 uv, vec3 c) {
    float l = dot(c, LUMA);
    l = adjustContrast(vec3(l), 0.45).r;
    l = clamp(l, 0.0, 1.0);
    vec3 o = vec3(l);
    o *= vignette(uv, 0.85, 0.85);
    return o;
  }

  void main() {
    vec2 uv = vUv;

    // ---- UV-space filters (must run before sampling) ----
    if (uFilter == 10) {           // fisheye — subtle, flattering
      uv = barrel(uv, -0.18);
    } else if (uFilter == 11) {    // mirror — vertical symmetry split
      uv.x = uv.x < 0.5 ? uv.x : 1.0 - uv.x;
    }

    vec3 color;

    if (uFilter == 6) {
      // VHS: chromatic aberration + scanlines + tracking wobble
      float wobble = sin(uv.y * 8.0 + uTime * 2.0) * 0.0015;
      wobble += (hash(vec2(floor(uTime * 12.0), floor(uv.y * 40.0))) - 0.5) * 0.004;
      vec2 ca = vec2(0.0035, 0.0);
      float r = texture2D(uTexture, uv + ca + vec2(wobble, 0.0)).r;
      float g = texture2D(uTexture, uv + vec2(wobble, 0.0)).g;
      float b = texture2D(uTexture, uv - ca + vec2(wobble, 0.0)).b;
      color = vec3(r, g, b);
      float scan = 0.85 + 0.15 * sin(uv.y * uResolution.y * 1.6);
      color *= scan;
      color = warmShift(color, -0.05);
      color = adjustSaturation(color, 0.15);
    } else {
      color = texture2D(uTexture, uv).rgb;

      if (uFilter == 1)       color = lookFilm(color);
      else if (uFilter == 2)  color = lookMono(color);
      else if (uFilter == 3)  color = lookRetro(uv, color);
      else if (uFilter == 4)  color = lookCool(color);
      else if (uFilter == 5)  color = lookPeach(uv, color);
      else if (uFilter == 7)  color = lookHalation(uv, color);
      else if (uFilter == 8)  color = lookPop(color);
      else if (uFilter == 9)  color = lookNoir(uv, color);
      // 0 original, 10 fisheye, 11 mirror -> clean color, distortion already in uv
    }

    // ---- shared adjust pass (edit sliders) ----
    color += uBrightness;
    color = adjustContrast(color, uContrast);
    color = adjustSaturation(color, uSaturation);
    color = warmShift(color, uWarmth);

    // ---- grain: per-filter baseline + slider ----
    float grainAmt = uGrain;
    if (uFilter == 1 || uFilter == 2) grainAmt = max(grainAmt, 0.06);
    if (uFilter == 3) grainAmt = max(grainAmt, 0.05);
    if (grainAmt > 0.0) {
      float g = hash(uv * uResolution + fract(uTime));
      color += (g - 0.5) * grainAmt * 0.5;
    }

    // retro dust specks
    if (uFilter == 3) {
      float d = hash(floor(uv * vec2(140.0, 90.0)) + floor(uTime * 6.0));
      if (d > 0.995) color += 0.4;
    }

    gl_FragColor = vec4(saturate3(color), 1.0);
  }
`;
