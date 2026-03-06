# SonarLox Design System

**Read this file before writing any UI code, CSS, or component markup.**

SonarLox looks like a piece of studio hardware, not a web app. Every visual decision reinforces the metaphor of a control room console — dark, precise, mechanical, information-dense. If a component could exist as a physical panel with LEDs and switches, it belongs. If it looks like it came from a component library, it doesn't.

---

## Identity

**Metaphor:** Broadcast control room console — the kind of equipment you'd find in a recording studio, a broadcast truck, or a sound stage. Dark metal surfaces, backlit indicators, mechanical precision.

**Not:** A SaaS dashboard. A music player app. A social platform. A design tool with a white canvas.

**The test:** Would an audio engineer feel at home? Would a bedroom producer feel like they upgraded? If the answer to both is yes, the design is right.

---

## Color

### Philosophy

The UI is almost entirely greyscale. Color is reserved for things that are active, urgent, or carrying data. A panel at rest is dark and quiet. A panel with audio playing has pops of teal and amber where energy is flowing. This contrast is what makes the interface feel alive during playback and professional at rest.

### Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-deep` | `#08090d` | Deepest background, viewport surround |
| `--bg-panel` | `#0d0f15` | Sidebar, panel backgrounds |
| `--bg-surface` | `#12141c` | Buttons, inputs, cards at rest |
| `--bg-elevated` | `#1a1d28` | Hover states, raised elements |
| `--accent-amber` | `#e8a027` | Primary action, active transport, dirty state, warnings |
| `--accent-teal` | `#0ea5a0` | Success, saved state, active toggles, selected items |
| `--accent-red` | `#e84057` | Error, mute active, destructive actions |

### Rules

- **No color on surfaces.** Backgrounds are always from the grey scale. Never tint a panel blue or add a gradient to a header.
- **Color means state.** Amber = needs attention or is active. Teal = confirmed or selected. Red = error or muted. Grey = at rest.
- **Glow, don't fill.** Active states use `box-shadow` glow effects on borders, not filled backgrounds. A selected button glows teal at its edge; it doesn't turn teal.
- **One accent per element.** Never combine amber and teal on the same component. Pick the one that matches the state.

---

## Typography

### Fonts

| Token | Font | Role |
|---|---|---|
| `--font-display` | Oxanium | Section headers, transport buttons, badge labels. The "hardware engraving" font. |
| `--font-body` | Outfit | Body text, section labels, descriptions. Readable, neutral. |
| `--font-mono` | Share Tech Mono | Data readouts, file paths, parameter values, timecodes. Anything a real display would show. |

### Rules

- **Display font for labels that would be silk-screened on hardware.** Section titles, button text on transport controls, toast type badges. Always uppercase, always letter-spaced.
- **Mono font for any value a machine would display.** Time readouts, BPM, frequencies, file sizes, coordinates. If it's a number or a path, it's mono.
- **Body font for everything humans read.** Descriptions, tooltips, dialog text. Sentence case, never uppercase.
- **Never use system fonts.** No Arial, Inter, Helvetica, Roboto. These break the hardware metaphor instantly.
- **Size discipline.** Most UI text is 9-12px. Headers are 10px uppercase tracked wide, not 16px+ like web conventions. Dense information is the goal, not generous whitespace.

---

## Surfaces & Depth

### Philosophy

Panels are recessed into the console, not floating above it. The metaphor is CNC-milled metal with inset displays, not cards on a canvas.

### Rules

- **Inset, not elevated.** Panels use `inset box-shadow` to feel recessed. Never use outward drop shadows to lift elements.
- **Noise texture on panels.** The sidebar has a subtle SVG fractal noise overlay at 3% opacity. This prevents the "flat digital" look and adds tactile quality. Apply to major panels, not to individual components.
- **Borders are seams, not decorations.** Use `--border-subtle` between sections (barely visible), `--border-default` for interactive element boundaries, `--border-focus` for focused/hovered states. Borders should feel like the gap between two metal panels.
- **No rounded corners over 3px.** Hardware has tight radii or sharp edges. 8px border-radius is a web convention — avoid it. Buttons are 3-4px. Panels are 2px or 0.
- **No white space generosity.** The console is dense. Padding is 4-8px, gaps are 2-6px. If the layout feels "airy," it's too loose.

---

## Components

### LEDs

Status indicators are always rendered as small circles (5-6px) with colored `background` and matching `box-shadow` glow. They pulse when active (`animation: ledPulse`). This is the primary status communication pattern — used in toasts, source rows, project dirty state.

- Teal LED = good / saved / active
- Amber LED = warning / unsaved / processing
- Red LED = error / muted (with pulse animation)

### Buttons

Buttons are flat metal surfaces that react to interaction:
- Rest: `--bg-surface` background, `--border-default` border
- Hover: background shifts to `--bg-hover`, border brightens to `--border-focus`
- Active: `translateY(1px)` — a physical press
- Accent buttons: border color shifts to accent, glow appears on hover. Never fill the button with accent color.

Transport buttons use `--font-display`, uppercase, letter-spaced. They should feel like silk-screened labels on hardware transport controls.

### Sliders / Range Inputs

Styled with custom thumb (14px circle, `--bg-elevated` with amber border) on a 4px track. The track is `--bg-elevated`, the thumb is the only interactive element. No fill color on the track — the value is read from the associated mono-font readout, not from a visual fill.

### Sections

All sidebar content uses the collapsible `Section` component. Chevron rotates on expand. Content animates in with `sectionReveal` (opacity + translateY, 150ms). Sections have:
- 10px uppercase tracked label (`--font-body`)
- Optional accessory element (badge, toggle) right-aligned in header
- 2px gap between sections (tight)

### Toasts

Console status strips, not web notification cards. Left border accent indicates type. LED dot + type badge (ERR/OK/SYS in mono) + message text. Drain bar animates across the bottom to show auto-dismiss timing. Slide in from bottom-left. Stack upward.

### Dialogs

Native OS confirmation dialogs for destructive actions (unsaved changes, remove source). Export dialog is a centered modal with dark overlay — simple, no tabs, no multi-step wizard. Radio buttons for mode selection, two action buttons (Cancel + Export).

---

## 3D Viewport

### Current State

- Room: wireframe box, `meshBasicMaterial`, 30% opacity blue
- Sources: `meshStandardMaterial` spheres with color from `SOURCE_COLORS`, emissive glow, amplitude-reactive scale
- Listener: directional wedge extending in -Z
- Grid: `gridHelper` with muted purple lines

### Target State (Viewport Overhaul — Tier 2)

- **Ground plane** replaces wireframe box — reflective dark surface with subtle grid, no walls or ceiling
- **Sources:** size, opacity, glow radius, and saturation driven by perceived volume (volume × distance attenuation × mute/solo state)
- **Muted sources:** ghostly, wireframe, desaturated
- **Connection lines:** faint lines from each source to listener, opacity = effective volume
- **Labels:** always visible above sources, mono font, small
- **Bloom post-processing:** subtle, only on emissive source spheres
- **Ambient lighting:** shifts subtly with master output energy
- **Background:** dark gradient or subtle starfield, not pure black void

### Rules for 3D

- **No cartoonish materials.** Sources are glowing orbs, not plastic spheres. Use emissive materials with bloom.
- **Information density in 3D.** Every visual element communicates audio state. If it's decorative without conveying data, remove it.
- **Camera defaults:** positioned at [8, 6, 8] looking at origin, 50° FOV. High enough to see the room layout, angled enough to read depth.

---

## Animation & Motion

### Philosophy

Mechanical, not organic. Things move because a mechanism actuated them, not because physics simulated them.

### Rules

- **Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (--ease-out).** Fast start, controlled settle. Used everywhere. No spring physics, no bounce, no elastic.
- **Duration: 120-250ms for UI transitions.** Chevron rotation is 150ms. Toast entrance is 300ms. Section reveal is 150ms. Nothing exceeds 300ms.
- **No ambient animation on idle UI.** The only things that animate without interaction are: LED pulses on active states, the transport playhead, and audio-reactive 3D elements. Everything else is still until touched.
- **Transform over opacity for interactive feedback.** `translateY(1px)` on button press. `rotate(90deg)` on chevron. `scale(0.98)` on apply button press. Physical metaphors.

---

## Anti-Patterns — Never Do These

1. **Rounded cards with drop shadows.** This is SaaS aesthetic. SonarLox panels are recessed, not floating.
2. **Blue/purple gradient backgrounds.** The single most common AI-generated aesthetic. The palette is amber/teal/red on near-black.
3. **Large section headers.** Headers are 10px uppercase tracked labels, not 18px bold text.
4. **Generous padding and whitespace.** The console is dense. If it looks like a marketing landing page, the spacing is wrong.
5. **Colorful backgrounds on states.** Active/selected states glow at their borders, they don't fill with color.
6. **Inter, Roboto, system fonts, or any sans-serif that isn't Oxanium or Outfit.** These break the identity.
7. **Icons from icon libraries (Lucide, Heroicons, etc).** Use text labels, LED dots, and minimal custom shapes. Hardware doesn't have Heroicons.
8. **Loading spinners.** Use indeterminate progress bars (the export bar style) or pulsing LEDs.
9. **Multi-step wizards or tabbed interfaces.** Keep flows single-screen. If it needs tabs, it's too complex — simplify the feature.
10. **Emojis or decorative illustrations.** The console doesn't have feelings.

---

## For AI Models

When generating UI code for SonarLox:

1. Read this file first. Every time.
2. Check existing components in `src/renderer/components/` for patterns before creating new ones.
3. Use the `Section` component for any new sidebar panel.
4. Use CSS custom properties from `:root` — never hardcode colors or fonts.
5. Match the density of existing components. Compare your padding and gaps to what's already in `styles.css`.
6. If your component doesn't look like it belongs on a piece of studio hardware, redesign it.
7. When in doubt, look at the toast system (`Toast.tsx` + toast CSS) — it's the purest expression of the design language.
