---
title: 'Device Fingerprinting: How Sites Know It''s You'
description: 'No cookie, no login, no localStorage — and a site still recognizes the same browser across sessions. Here is what canvas, WebGL, and font enumeration actually measure, and why the combination is the point.'
pubDate: 2026-06-17
tags: ['privacy', 'web', 'security']
---

Clear cookies, open a private window, disable third-party storage — and
some sites still recognize you as the same visitor within a session or
two. No cookie was set. No `localStorage` key was written. What
happened is your browser answered a handful of ordinary, permission-
free JavaScript questions, and the *combination* of answers was
distinctive enough to act as an identifier nobody explicitly assigned
you.

This is device fingerprinting, and the part worth understanding isn't
any single signal — most of them are individually weak — it's how weak
signals compose into a strong one.

## The signals, roughly ranked by how much they tell on their own

**User-Agent and `navigator` properties** are the cheapest and least
useful alone: OS, browser, screen resolution. Millions of people share
each value. Fine as one input among many, useless by itself.

**Canvas fingerprinting** asks the browser to render text or shapes to
an off-screen `<canvas>` and reads back the pixel data.

```javascript
function canvasFingerprint() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "14px 'Arial'";
  ctx.fillStyle = "#f60";
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = "#069";
  ctx.fillText("fingerprint test 🔒", 2, 15);
  return canvas.toDataURL();
}
```

The trick is that this isn't random — it's *consistently different*
across machines. Font rasterization, anti-aliasing, and GPU rendering
paths vary by OS, GPU driver, and browser version, so the exact pixel
output is a fingerprint of your rendering stack, reproducible every
time you run it on the same machine, different across most other
machines.

**WebGL fingerprinting** goes a layer lower and asks the GPU directly.

```javascript
function webglFingerprint() {
  const gl = document.createElement("canvas").getContext("webgl");
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    vendor: gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
    renderer: gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
  };
}
```

This one can return something as specific as the exact GPU model and
driver string — `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0
ps_5_0, D3D11)` is not a value shared by many machines on earth.

**Font enumeration** measures which of a probe list of font names
actually changes text width when applied — an indirect way to detect
installed fonts without a permission the browser would prompt for. The
specific *set* of fonts installed correlates strongly with OS, region,
and installed software (design tools, IDEs, language packs all add
fonts).

**AudioContext fingerprinting** is the least intuitive: render a short
signal through the Web Audio API's oscillator and analyser nodes and
hash the output. Floating-point rounding differences in the audio
stack's implementation vary slightly by hardware and OS in ways that
are stable per-device and near-invisible to the user, since no sound is
actually played.

## Why the combination beats any single signal

Here's the part that matters more than any individual technique: screen
resolution alone might be shared by 8% of visitors. Installed font set
alone, maybe 4%. GPU renderer string, maybe 2%. None of those narrows a
crowd meaningfully by itself. But signals like these are largely
*independent* of each other — your GPU model doesn't correlate with
your font list the way, say, browser version correlates with OS does —
and independent low-entropy signals combine multiplicatively.

```python
# rough intuition, not a real formula fingerprinting libraries use
def uniqueness(signal_probabilities: list[float]) -> float:
    combined = 1.0
    for p in signal_probabilities:
        combined *= p
    return combined  # smaller -> more unique among visitors

signals = [0.08, 0.04, 0.02, 0.15, 0.30]  # resolution, fonts, GPU, UA, timezone
print(uniqueness(signals))  # ~0.0000029 -> roughly 1-in-345,000
```

Stack five or six independently-varying signals and you land in
"unique among a few hundred thousand visitors" territory without
touching a single storage API. This is the actual reason fingerprinting
survives cookie clearing, private browsing, and storage partitioning:
none of those defenses touch anything the fingerprint reads, because
the fingerprint never wrote anything down in the first place — it's
reading properties of your hardware and software that were always
observable to any page that asked.

## What actually resists it, and what doesn't

Cookie clearing does nothing, by the mechanism above. A VPN changes
your IP and rough geography, which is one input among many, not a
reset of the rest. What actually moves the needle:

- **Font and canvas noise injection** — Firefox's `resistFingerprinting`
  mode and browsers like Tor Browser deliberately add small, randomized
  noise to canvas and audio output on every read, so the same device
  reports a slightly different fingerprint each session.
- **Normalizing the signal pool** — Tor Browser's stronger move: make
  every user report the *same* values where feasible (same reported
  fonts, same window size via letterboxing) so there's less variance to
  fingerprint in the first place. A fingerprint with no entropy left in
  it isn't a fingerprint.
- **Blocking specific APIs** — disabling WebGL or blocking Canvas API
  reads (uBlock Origin and similar extensions can prompt or block on
  `toDataURL()` calls) removes individual signals, which helps some but
  not against a script using the remaining ones.

None of this is complete. A sufficiently motivated fingerprinting
script degrades gracefully as individual signals get blocked — it just
falls back to whatever's left. The honest takeaway from the defense
side is that fingerprinting resistance is a probability shift, not a
guarantee, in a way cookie deletion never had to be.

## What I learned

The mental model that stuck: a fingerprint isn't one measurement, it's
an entropy budget. Every property a page can read for free —
resolution, fonts, GPU, timezone, installed plugins, even how fast your
CPU executes a specific benchmark loop — spends a little bit of that
budget, and it doesn't take many properties before the budget's gone
and the visitor is unique. If you're building something privacy-
sensitive, the question isn't "does this API leak PII," it's "does this
API narrow the crowd," and by that standard, far more of the browser's
surface area counts than the word "fingerprinting" usually gets credit
for.
