# privacy, in plain words

**twoplace stores nothing about you. Anywhere. Ever.**

That's the whole policy, but here's exactly what that means:

## what never exists

- **No accounts.** There is nothing to sign up for.
- **No database.** We don't run one. There is no server that could store your
  photos even if we wanted it to.
- **No analytics, no trackers, no cookies.** The app ships zero tracking
  scripts and sets zero cookies.
- **No names.** The app never asks who you are.

## where your photos go

Nowhere. Your webcam feed is processed entirely inside your browser (WebGL
shaders on your own GPU). Captured photos live in your tab's memory. When you
download, share, or email a strip, that file goes where *you* send it — and
the moment you close the tab, everything in memory is gone.

## how the two-person rooms work

Rooms are **peer-to-peer WebRTC**. A free public signalling broker (PeerJS
cloud) is used only for the introduction — like a telephone operator
connecting a call, it never sees the conversation. Photos, drawings, quiz
answers, votes, and video travel **directly between your two browsers**,
end-to-end, and are never uploaded anywhere. Room codes are random, single-use,
and die the instant either tab closes.

## the email button

"Email it to yourself" sends the address you type straight to EmailJS (a
client-side email relay) together with the image, one time. The address is
**never stored, never logged, never remembered** — there is no "remember me"
because there is nowhere to remember it to.

## what *is* stored

Three device preferences in your own browser's localStorage, so the app feels
consistent between visits: sound muted (yes/no), mirror preview (yes/no), and
lite mode (yes/no). No personal data, no photos, no history. Clear your
browser storage and even that is gone.

## the promise in the footer

> your photos never touch a server — everything stays on your devices

It's not marketing copy; it's the architecture.
