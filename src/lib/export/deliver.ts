/** deliver.ts — download / native-share / email of the finished strip. */
import emailjs from '@emailjs/browser';
import { APP_NAME, EMAIL_RATE_LIMIT_MS, LS_KEYS } from '@/config/app';

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', q = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, q),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stampName(ext: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${APP_NAME}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}

/** Web Share with file attached; returns false if unsupported so caller can fall back. */
export async function shareImage(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: APP_NAME, text: `my ${APP_NAME} strip ♡` });
      return true;
    } catch (e) {
      // user cancelled — treat as handled
      if ((e as DOMException).name === 'AbortError') return true;
      return false;
    }
  }
  return false;
}

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function emailRateLimited(): number {
  const last = Number(localStorage.getItem(LS_KEYS.lastEmailAt) || 0);
  const remaining = EMAIL_RATE_LIMIT_MS - (Date.now() - last);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/** Downscale a canvas so the base64 payload stays under EmailJS limits (~50KB body). */
export async function emailSizedDataUrl(canvas: HTMLCanvasElement, targetW = 800): Promise<string> {
  const scale = Math.min(1, targetW / canvas.width);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

export interface EmailResult {
  ok: boolean;
  message: string;
}

export async function emailStrip(toEmail: string, dataUrl: string, fromName: string): Promise<EmailResult> {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey || serviceId.includes('xxxxx')) {
    return { ok: false, message: 'Email is not configured yet (see README).' };
  }
  const wait = emailRateLimited();
  if (wait > 0) return { ok: false, message: `Please wait ${wait}s before sending again.` };

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: toEmail,
        from_name: fromName || 'a friend',
        app_name: APP_NAME,
        message: `Here's your ${APP_NAME} strip! ♡`,
        strip_image: dataUrl, // base64 data URL — see README for template setup
      },
      { publicKey },
    );
    localStorage.setItem(LS_KEYS.lastEmailAt, String(Date.now()));
    return { ok: true, message: 'Sent! Check your inbox ♡' };
  } catch (e) {
    return { ok: false, message: `Could not send: ${(e as Error).message || 'unknown error'}` };
  }
}
