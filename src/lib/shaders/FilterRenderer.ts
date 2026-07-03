/**
 * FilterRenderer — a tiny standalone WebGL pipeline that draws a source
 * (video element OR image) through the parametric filter shader onto a canvas.
 *
 * It is deliberately framework-agnostic (no three.js) so it can:
 *   • drive the live preview every frame,
 *   • be sampled as a texture on the 3D booth mirror,
 *   • render one full-resolution frame for a clean capture,
 *   • re-render captured stills in the edit screen.
 *
 * The program is compiled ONCE. Changing filter/adjust only sets uniforms.
 */

import {
  VERTEX_SHADER,
  FRAGMENT_SHADER,
  type AdjustState,
  NEUTRAL_ADJUST,
} from './filters';

export interface RenderOptions {
  filterIndex: number;
  mirror: boolean;
  adjust?: AdjustState;
  time?: number;
}

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

export class FilterRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private startTime = performance.now();
  private disposed = false;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', {
      preserveDrawingBuffer: true, // needed so we can read pixels for capture
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    this.program = this.buildProgram();
    gl.useProgram(this.program);

    // full-screen quad
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    for (const name of [
      'uTexture', 'uResolution', 'uTime', 'uFilter', 'uFlipX',
      'uBrightness', 'uContrast', 'uSaturation', 'uWarmth', 'uGrain',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + log);
    }
    return shader;
  }

  private buildProgram(): WebGLProgram {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
  }

  /** Resize the drawing buffer to match a source resolution. */
  resize(w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private sourceSize(src: Source): [number, number] {
    if (src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight];
    if (src instanceof HTMLImageElement) return [src.naturalWidth, src.naturalHeight];
    return [src.width, src.height];
  }

  /** Render one frame of `source` through the shader. */
  render(source: Source, opts: RenderOptions) {
    if (this.disposed) return;
    const gl = this.gl;
    const [sw, sh] = this.sourceSize(source);
    if (!sw || !sh) return;
    this.resize(sw, sh);

    gl.viewport(0, 0, sw, sh);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    const a = opts.adjust ?? NEUTRAL_ADJUST;
    const time = (opts.time ?? (performance.now() - this.startTime)) / 1000;
    gl.uniform1i(this.uniforms.uTexture, 0);
    gl.uniform2f(this.uniforms.uResolution, sw, sh);
    gl.uniform1f(this.uniforms.uTime, time);
    gl.uniform1i(this.uniforms.uFilter, opts.filterIndex);
    gl.uniform1f(this.uniforms.uFlipX, opts.mirror ? 1 : 0);
    gl.uniform1f(this.uniforms.uBrightness, a.brightness);
    gl.uniform1f(this.uniforms.uContrast, a.contrast);
    gl.uniform1f(this.uniforms.uSaturation, a.saturation);
    gl.uniform1f(this.uniforms.uWarmth, a.warmth);
    gl.uniform1f(this.uniforms.uGrain, a.grain);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Capture the current canvas as a blob (full-res clean frame). */
  toBlob(type = 'image/png', quality = 0.95): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        type,
        quality,
      );
    });
  }

  toDataURL(type = 'image/png', quality = 0.95): string {
    return this.canvas.toDataURL(type, quality);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}
