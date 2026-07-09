# 💞 twoplace — a tiny pastel world you visit together

A production-grade **3D online photobooth + date-activities hub for
long-distance couples**. A dreamy low-poly street where you and your person —
anywhere on earth — take photo strips through real WebGL filters, quiz each
other, draw on one canvas, argue about pineapple pizza, and duel in a tiny
arcade. All of it peer-to-peer, all of it free, none of it stored.

> Rename the app any time by changing a single constant: `APP_NAME` in
> [`src/config/app.ts`](src/config/app.ts).

## the two hard rules

1. **Nothing is sold. Ever.** No shop, no paid HD, no upsells. Memories leave
   as soft copies: instant download, native share, or email-to-self.
2. **Zero user data stored. Anywhere.** No accounts, no database, no
   analytics, no cookies, no personal localStorage. Rooms are ephemeral
   peer-to-peer; close the tab and everything is gone. See
   [PRIVACY.md](PRIVACY.md).

> *your photos never touch a server — everything stays on your devices*

## ✨ what's inside

### the hub street
A little 3D pastel plaza (React Three Fiber, primitives only — no GLB
downloads): the **photobooth** in the middle, an **arcade cabinet**, a **quiz
kiosk**, a **drawing easel**, and a **debate stage**. Scroll/drag pans the
street, clicking a machine dollies the camera in (GSAP). Street lighting
follows *your local time* — warm day, lilac dusk, starry night — computed
live, never stored. A plain-text top nav and a 2D **lite mode** street cover
weak devices and 3D-haters.

### the photobooth
- **12 WebGL filters** in ONE parametric shader (original · film · peach ·
  mono · retro · cool · vhs · halation · pop · noir · fisheye · mirror) —
  compiled once, switching costs one uniform.
- **5 modes**: classic strip (4 shots) · single snap · burst (pick 4 of 8) ·
  boomerang GIF (Web-Worker encoded) · smile trigger (MediaPipe, lazy-loaded,
  falls back to a timer).
- Captures store the **raw frame**; every filter/adjustment is re-applied
  through the same shader at export, so preview and file are pixel-identical.
- Full editor: 5 layouts, frame colors + patterns, caption, date stamp,
  optional `pune ↔ toronto` cities footer (typed by hand, never detected),
  brightness/contrast/saturation/warmth/grain in-shader, 26 SVG + text
  stickers with full gesture support, 20+-step undo/redo.
- Delivery: hi-res PNG download, Web Share API, or **email-to-self**
  (EmailJS, address used once and discarded).

### rooms for two 💌
"open a room" mints a **single-use 5-letter code** (unambiguous alphabet —
no 0/O/1/I). Your person types it in anywhere in the world; PeerJS's free
cloud brokers the introduction and everything after is direct P2P. Each of
you picks an **accent color** for the session (borders, chips, UI).

- **Split mirror screen** — host left, guest right, same filter vibe on both.
- **Synced countdown** — the host is the authoritative clock; an NTP-style
  ping exchange measures RTT/offset and the shutter fires at the same
  `fire_at` instant on both machines. Both webcams shoot at native
  resolution, frames swap over the data channel, and **both people get the
  full combined strip**. The protocol is documented in
  [`src/lib/room/clock.ts`](src/lib/room/clock.ts).
- **Either person can press the shutter.** Retakes are mutual — both see
  "redo last?".
- **Duet boomerang** — both sides record the same 1.5s window, exchange
  frames, and each end composes one side-by-side looping GIF.
- Floating **emoji reactions** and a **pose-idea card deck** ("finger
  hearts!", "recreate your first pic") synced to both screens.
- Rooms die when a tab closes. Codes are single-use. Nothing persists.

### date activities (same room, same code)
No AI judges anywhere — your partner is the judge:

1. **how well do you know me** — 3 packs × 15 questions (cute / silly /
   deep). One answers as truth, the other guesses; locks are private, the
   reveal is simultaneous, matches get confetti and a compatibility score.
   Solo? **Pass-and-play** on one device.
2. **draw together** — one prompt, one canvas, half each. Strokes stream
   live but their half stays covered until the timed reveal; then you rate
   each other out of 10 with a cute stamp and export the drawing as a PNG.
3. **debate club** — random topic + random sides, 60s each on camera, then
   both secretly rate the opponent on funny/convincing/dramatic sliders;
   simultaneous reveal; best-of-3 wears the crown.
4. **mini arcade** — reaction-tap duel (same signal fires on both screens via
   the shared clock) and a 30-second emoji memory-match race (identical
   seeded boards). Adding a game is one entry in
   [`src/components/activities/arcade/games.ts`](src/components/activities/arcade/games.ts).

Every activity ends with a "take a booth pic to remember this?" shortcut that
drops you both straight into the duo booth.

## 🧱 stack

Next.js 15 (App Router) · TypeScript · React Three Fiber + drei · GSAP ·
Zustand · raw WebGL shaders · PeerJS (WebRTC) · gifenc in a Web Worker ·
EmailJS · MediaPipe tasks-vision (CDN, lazy). No analytics, no trackers,
no AI SDKs.

## 🚀 getting started

```bash
npm install
cp .env.example .env.local   # then fill in your EmailJS keys (see below)
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

> **Camera:** browsers only grant `getUserMedia` on `localhost` or **HTTPS**.
> Local dev works out of the box; deploy to Vercel for HTTPS.

## 📁 architecture

```
src/
  config/app.ts            # APP_NAME, palette, accents, privacy promise
  store/useBoothStore.ts   # Zustand: phases, shots, filters, edit history, duo state
  lib/
    room/                  # PeerJS room, clock sync (fire_at protocol),
                           #   activity channel, edit sync, session events
    shaders/               # the 12-look über-shader + FilterRenderer
    capture/               # useCamera, frameGrab, modes, smile (MediaPipe)
    export/                # composite (one canvas pipeline = pixel parity),
                           #   deliver (download/share/email), gif.worker
    sound/                 # procedural WebAudio SFX (no audio files)
    daynight.ts            # local-time street lighting themes
    device.ts              # WebGL / lite-mode / reduced-motion detection
  components/
    hub3d/                 # Landing, HubCanvas, StreetScene, Machines, LiteStreet
    booth3d/               # InteriorScene (the 3D booth interior)
    capture/               # CaptureView, FilterRail, ModeDial, poses, burst, gif
    edit/                  # EditScreen, StripPreview, StickerLayer, EditPanel, Email
    activities/            # ActivityHost + RoomGate
      quiz/  draw/  debate/  arcade/   # each its own lazy chunk
    duo/                   # DuoLobby (code create/join + accent picker)
    ui/                    # TopBar, Decorations, toast
```

Everything heavy is a separate dynamic chunk: the 3D street, the booth
interior, each activity, each arcade game, the GIF worker, PeerJS, MediaPipe.

## 💞 how the room sync works (short version)

1. Host claims PeerJS id `twoplace-v1-<code>`; guest claims `<code>-g` and
   connects — one reliable data channel + one media call, both direct P2P.
2. The guest pings the host a few times, keeps the lowest-RTT sample, and
   derives `offset = host clock − my clock` (NTP style).
3. Any shutter press ends up at the host, which broadcasts
   `capture-start { fire_at }` in host-clock time. Both sides count down to
   their local translation of `fire_at` and capture at the same instant.
4. Shots are exchanged as compressed JPEGs and composed **host-left /
   guest-right on both ends**, so the strips match without further sync.

Full commentary in [`src/lib/room/clock.ts`](src/lib/room/clock.ts) and
[`src/lib/room/room.ts`](src/lib/room/room.ts).

> **NAT note:** the free PeerJS cloud does signalling only; a strict
> corporate/CGNAT network can still block the direct link. The lobby surfaces
> friendly retry tips (drop VPN, try mobile data). Swapping in your own
> broker/TURN later = editing `newPeer()` in `src/lib/room/room.ts`.

## 💌 EmailJS setup ("email it to yourself")

1. Create a free account at <https://dashboard.emailjs.com>.
2. **Email Services** → add a service (e.g. Gmail) → copy its **Service ID**.
3. **Email Templates** → create a template → copy its **Template ID**.
   Use these variables (exact names matter):

   | variable          | meaning                                    |
   | ----------------- | ------------------------------------------ |
   | `{{to_email}}`    | recipient — set the template **To** field to this |
   | `{{from_name}}`   | the app name                               |
   | `{{app_name}}`    | the app name                               |
   | `{{message}}`     | a short body line                          |
   | `{{strip_image}}` | the strip as a base64 data URL             |

   Show the photo in the body with:

   ```html
   <p>{{message}}</p>
   <img src="{{strip_image}}" alt="your strip" style="max-width:400px;border-radius:12px" />
   ```

   > Some providers strip base64 `<img>`. The strip is downscaled to ~800px
   > to fit EmailJS's ~50KB variable limit; you can also attach it as a file
   > in the template settings instead.

4. **Account → API Keys** → copy your **Public Key**.
5. Put all three in `.env.local` (see `.env.example`).

Sends are rate-limited client-side to 1 per 30s (tracked in memory only).
Missing keys → the button explains itself instead of breaking.

## ☁️ deploy (Vercel)

Push to GitHub, import into Vercel, add the three `NEXT_PUBLIC_EMAILJS_*`
env vars, deploy. HTTPS (required for the camera) is automatic. There is no
server code to configure — it's a fully static client app.

## 📝 intentional choices

- **The booth interior is a crafted 2D environment** rendering the live
  shader canvas directly, while the street and booth exterior are full 3D.
  Deliberate: it holds 60fps on mid-range phones and keeps the live filter at
  full webcam resolution instead of paying for video-as-texture sampling.
- **One compositor.** Preview and export share
  `lib/export/composite.ts`, so what you see is bit-for-bit what you download.
- **One shader.** All 12 filters are uniform switches on a single compiled
  program — no recompiles mid-session, ever.
- **MediaPipe never touches the initial bundle** — CDN-loaded only when smile
  mode is chosen, with a timer fallback if it fails.
