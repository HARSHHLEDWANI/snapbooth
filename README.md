# 📸 snapbooth — a pastel dream photobooth

A production-grade **3D online photobooth** web app. Walk up to a cute low-poly
booth, step through the curtain, snap a strip through real-time WebGL filters,
decorate it, and download / share / email it — **no backend of your own**.

> Rename the app any time by changing a single constant: `APP_NAME` in
> [`src/config/app.ts`](src/config/app.ts).

---

## ✨ Features

- **💞 Booth for two (long-distance duo mode)** — create a private room, send
  one link, and a friend anywhere in the world joins your booth. You see each
  other live (host left, guest right), one SNAP fires a **synchronized
  countdown on both sides**, and every shot is smashed together into a single
  side-by-side frame — identical strips on both ends. Duo **burst** works too
  (host picks the best 4 for both). Afterwards you **edit the strip together**:
  frames, filters, captions and stickers sync live between both editors.
  All peer-to-peer over WebRTC (PeerJS public cloud for signalling) — still no
  backend of our own.
- **3D booth exterior** (React Three Fiber) built entirely from primitives — no
  external GLB downloads. GSAP dollies the camera *through the curtain* on entry.
- **3D booth interior** — the capture screen is a real 3D room: the live
  filtered feed plays on the booth's mirror as a canvas texture, with fairy
  lights, curtains, and a shelf. Drag to look around, scroll to lean in
  (constrained orbit so you never leave the booth).
- **Real-time WebGL filters** — one parametric fragment shader, **12 looks**
  (original, film, peach, mono, retro, cool, vhs, halation, pop, noir, fisheye,
  mirror). Compiled once; switching a filter only swaps a uniform.
- **5 capture modes** — classic strip · single snap · burst (pick 4 of 8) ·
  boomerang GIF (encoded in a Web Worker) · hands-free smile trigger (MediaPipe,
  lazy-loaded only when selected).
- **Full 2D editor** — layouts, frame colors/patterns, per-strip filter,
  brightness/contrast/saturation/warmth/grain (all in the shader), 26 SVG
  stickers + text stickers (drag / pinch / scroll / rotate / delete), undo/redo.
- **Export & delivery** — high-res PNG (2×, ~1200px wide), Web Share API,
  EmailJS with a downscaled base64 image, and a "my strips" drawer in
  localStorage.
- **Graceful fallback** — a 2D "lite mode" booth for weak devices or when WebGL
  is unavailable, plus a cute illustrated camera-permission error state.
- **Polish** — procedural WebAudio SFX (mute toggle), custom heart cursor,
  paper-grain panels, `prefers-reduced-motion` support, keyboard capture
  (`space` = shutter, `←/→` = filters), full mobile layout.

## 🧱 Stack

Next.js 15 (App Router) · TypeScript · React Three Fiber + drei · GSAP · Zustand
· raw WebGL shaders · gifenc (in a Web Worker) · EmailJS · MediaPipe tasks-vision
(CDN, lazy).

## 🚀 Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your EmailJS keys (see below)
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

> **Camera:** browsers only grant `getUserMedia` on `localhost` or **HTTPS**.
> Local dev on `localhost` works out of the box; deploy to Vercel for HTTPS.

## 📁 Architecture

```
src/
  config/app.ts            # APP_NAME + palette + tuning constants
  store/useBoothStore.ts   # Zustand: phases, shots, filter, mode, edit + history
  lib/
    shaders/               # filters.ts (the 12-look über-shader) + FilterRenderer
    capture/               # useCamera, frameGrab, modes, smile (MediaPipe)
    export/                # composite (strip), deliver (dl/share/email), gif.worker
    sound/                 # procedural WebAudio SFX
    stickers.tsx           # 26 inline SVG stickers
    device.ts              # WebGL / lite-mode / reduced-motion detection
  components/
    booth3d/               # Landing, Booth3D (Canvas), BoothExterior, LiteExterior
    capture/               # CaptureView + FilterRail, ModeDial, Burst/Gif/Print…
    edit/                  # EditScreen, StripPreview, StickerLayer, EditPanel, Email
    ui/                    # TopBar, NamePrompt, MyStrips, Decorations, toast
```

## 💞 Booth for two — how it works

1. On the landing page hit **"booth for two"** → **"create our room"**.
2. Send the generated link (`…?room=abc12`) to your person — any distance works.
3. When they open it, you both drop into the same booth: you see yourself and
   them side by side, live, with the same filter.
4. Either of you presses **SNAP** — a synchronized countdown runs on both
   screens and every shot combines both webcams into one frame (host on the
   left, guest on the right).
5. **Burst** works too: 8 synced pairs, the host picks the best 4 for both.
6. The edit screen is shared — frame colors, filters, captions and stickers
   sync live while you decorate together. Both of you can download the strip.

Under the hood it's pure WebRTC peer-to-peer; the free PeerJS cloud only
brokers the introduction. Photos travel directly between the two browsers and
never touch a server. (Boomerang & smile-trigger are solo-only modes.)

## 💌 EmailJS setup ("email me my strip")

1. Create a free account at <https://dashboard.emailjs.com>.
2. **Email Services** → add a service (e.g. Gmail) → copy its **Service ID**.
3. **Email Templates** → create a template → copy its **Template ID**.
   Configure the template to use these variables (exact names matter):

   | Template variable | What it is                                   |
   | ----------------- | -------------------------------------------- |
   | `{{to_email}}`    | recipient (set the template **To** field to this) |
   | `{{from_name}}`   | the visitor's name                           |
   | `{{app_name}}`    | the app name (`snapbooth`)                   |
   | `{{message}}`     | a short body message                         |
   | `{{strip_image}}` | the strip as a base64 data URL               |

   To show the photo in the email, add this to the template HTML body:

   ```html
   <p>{{message}}</p>
   <img src="{{strip_image}}" alt="your snapbooth strip" style="max-width:400px;border-radius:12px" />
   ```

   > Some providers strip base64 `<img>`. If images don't appear, the strip is
   > downscaled to ~800px to fit EmailJS's ~50KB variable limit; you can also
   > attach it as a file in the template settings instead.

4. **Account → API Keys** → copy your **Public Key**.
5. Put them in `.env.local`:

   ```bash
   NEXT_PUBLIC_EMAILJS_SERVICE_ID=service_xxxxxxx
   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=template_xxxxxxx
   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx
   ```

Email sends are **rate-limited client-side to 1 per 30s** to protect the free
tier. If keys are missing, the button shows a friendly "not configured" message.

## ☁️ Deploy (Vercel)

Push to GitHub, import into Vercel, add the three `NEXT_PUBLIC_EMAILJS_*` env
vars, deploy. HTTPS (required for the camera) is automatic.

## 📝 Notes & intentional choices

- **Interior UI:** the booth *exterior* is full 3D (R3F). The capture *interior*
  is a crafted 2D booth environment (curtains, control panel, arcade button,
  mode dial, film-strip rail) that renders the live shader canvas directly.
  This was a deliberate performance/quality call — it holds a rock-solid 60fps
  on mid-range hardware and keeps the live filter at full webcam resolution,
  rather than paying to sample video-as-a-texture inside the 3D scene.
- **Captures are clean frames.** Shots store the raw full-resolution webcam
  frame; filters + adjustments are re-applied through the exact same shader at
  composite time, so the export is pixel-identical to the preview and you can
  change the filter after shooting.
- **MediaPipe** is loaded from CDN only when smile mode is chosen; it never
  touches the initial bundle. If it fails to load, capture falls back to a timer.
