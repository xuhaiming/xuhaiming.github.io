---
name: Haiming Pages
description: A cold glass core lit in the dark, with one condensed grotesque set over it on hairlines.
colors:
  ground: "#04070f"
  ink: "#eef3ff"
  ink-2: "#a3b4d2"
  ink-3: "#7487a8"
  line: "rgb(150 180 255 / 0.18)"
  blue: "#3d78ff"
  ice: "#dcecff"
  cyan: "#74e2ff"
  violet: "#a38bff"
  core-blue: "#0b3dff"
  glow-blue: "#2a63ff"
  orbit-line: "#b9d2ff"
  ring-metal: "#0d1322"
typography:
  display:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2.5rem, 4.7vw, 5.25rem)"
    fontWeight: 780
    lineHeight: 0.98
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 70"
  headline:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2.25rem, 4.1vw, 4.5rem)"
    fontWeight: 780
    lineHeight: 0.98
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 70"
  title:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.5rem, 2.3vw, 2.375rem)"
    fontWeight: 720
    lineHeight: 1.05
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 78"
  lead:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
  body:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.6
    fontVariation: "'wdth' 100"
  mono:
    fontFamily: "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  focus: "2px"
  pill: "999px"
spacing:
  gutter: "clamp(1.25rem, 3.6vw, 4rem)"
  column: "min(34rem, 100%)"
  row: "1.35rem"
  stack: "1.75rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.4rem"
  button-primary-hover:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.ground}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.45rem 1rem"
  input-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.lead}"
    padding: "1rem 0"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "0.35rem 0"
  text-link:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0.5rem 0"
  contact-link:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
  skip-link:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    padding: "0.5rem 0.9rem"
---

# Design System: Haiming Pages

## Overview

**Creative North Star: "The Lit Core"**

One lit object stands in for one engineer. A cold glass core floats on a blue-black ground and never leaves the screen: a single WebGL scene sits fixed behind the whole page, and the scroll moves one camera around it instead of swapping backgrounds per section. Everything luminous belongs to that scene. The page layer on top is deliberately the opposite: flat type, hairlines and thin pills, with no fills, no panels and no shadows of its own.

The scene is built from a small, fixed kit: an ice-to-blue emissive core, additive dichroic glass shells whose rims throw thin cyan and violet slivers, three fine dark metal rings, two hairline orbits carrying four faceted glass nodes, a pooled reflection underneath, drifting dust, and a point-cloud portrait that assembles in About while the core withdraws. A finish pass adds a faint chromatic split at the edges, a vignette and fine grain. One voice of type, Archivo, does all the talking: condensed and heavy for headings, normal width for reading.

Motion is one grammar. The camera eases toward scroll-set poses, DOM elements rise out of a short blur on a single exponential ease-out, and the core answers the pointer and pulses on each step of the scripted agent run. Reduced-motion keeps every state visible and slows the scene to a near-still drift.

**Key Characteristics:**
- One persistent lit object; the page is a camera move around it, not a stack of scenes.
- Light lives in the scene only. The DOM layer is flat ink, hairlines and outline pills.
- One typeface, two widths: condensed 70 to 78 for headings, 100 for reading.
- Hairline rows instead of cards.
- Cold palette end to end: the DOM has no warm hue, and the scene's warmest note is a faint magenta in the glass film.
- All copy is real HTML above the canvas and stays readable when WebGL is absent.

## Colors

A cold, near-monochrome blue field: one blue-black ground, three steps of blue-tinted ink, and light that runs from ice white to electric blue.

### Primary
- **Ice** (`ice`): the light colour. The core's limb, the focus ring, the input underline on focus, the numerals inside case facts, and the primary button's hover.
- **Electric Blue** (`blue`): the DOM's only saturated blue, used for text selection and as the glow in the no-WebGL fallback background.
- **Core Blue** (`core-blue`): the scene's own deeper blue, seen where you look straight into the core. Scene only.
- **Glow Blue** (`glow-blue`): the halo around the core and the pooled light on the floor. Scene only, additive.

### Secondary
- **Sliver Cyan** (`cyan`): one of the two dichroic rim colours in the glass. In the DOM it appears twice only: the text caret and the tool-call code in the agent run.

### Tertiary
- **Sliver Violet** (`violet`): the other dichroic rim colour. Scene only; the DOM token is declared but not yet used.

### Neutral
- **Ground** (`ground`): page background, veil, theme colour, and the text colour on ink-filled controls.
- **Ink** (`ink`): headings, body copy, nav, pills.
- **Ink 2** (`ink-2`): secondary copy: case descriptions, dates, tool lists, row roles, fine print.
- **Ink 3** (`ink-3`): placeholder text and the resting input underline.
- **Line** (`line`): every hairline: list rules, pill outlines, link underlines at rest.
- **Orbit Line** (`orbit-line`): the two orbit paths in the scene, drawn at 42% opacity.
- **Ring Metal** (`ring-metal`): the three machined rings; fully metallic, seen only through what they reflect.

### Named Rules
**The Core Owns The Light Rule.** Glow, bloom, iridescence and saturated blue belong to the scene. DOM elements are never lit: no glows, no gradient fills, no coloured surfaces. The only gradient in CSS is the fallback that stands in for the scene when WebGL is unavailable.

**The Two Slivers Rule.** Cyan and violet are rim light, not brand colours. In the DOM, cyan marks only what a machine typed (caret, tool-call code); violet does not appear.

**The Veil Rule.** When dense reading sits over the scene, the scene is dimmed by a ground-coloured veil (0.3 to 0.62 depending on section) rather than by putting a panel behind the text.

## Typography

**Display Font:** Archivo variable, self-hosted (with 'Helvetica Neue', Arial, sans-serif)
**Body Font:** Archivo at normal width (same file)
**Label/Mono Font:** system monospace stack, used only for tool-call code

**Character:** One grotesque doing two jobs through its width axis. Headings are condensed and heavy with tight leading, so they read as a compact block against the scene; reading text is the same face at normal width and regular weight.

### Hierarchy
- **Display** (780, width 70, clamp(2.5rem, 4.7vw, 5.25rem), 0.98): the hero headline, three balanced lines. The closing contact heading uses the same voice one step larger (clamp(2.75rem, 6vw, 6rem)).
- **Headline** (780, width 70, clamp(2.25rem, 4.1vw, 4.5rem), 0.98): one per section.
- **Title** (720, width 78, clamp(1.5rem, 2.3vw, 2.375rem), 1.05): facet names, case titles, employer names in the path (fixed 1.625rem), contact links.
- **Lead** (400, width 100, 1.1875rem, 1.5): facet and About paragraphs, the agent's answer. Capped at 34 to 36ch. Drops to body size below 860px.
- **Body** (400, width 100, 1.0625rem, 1.6): case descriptions and general copy, capped at 54 to 62ch.
- **Label** (500, width 100, 0.9375rem): nav, name line on phones, scene labels, row roles. Secondary notes use the same size at 400 in Ink 2. Sentence case, no tracking.
- **Mono** (0.875rem, Cyan): tool-call code in the agent run only.

### Named Rules
**The Two Widths Rule.** Condensed width means heading, normal width means reading. Never set running text condensed, and never set a heading at normal width.

**The Weight-Not-Case Rule.** Emphasis comes from weight (500 for labels, 650 for actions, 720 to 780 for headings). There is no uppercase and no letter-spaced small text anywhere in the build.

## Layout

A single scrolling page laid over a fixed full-viewport canvas. Sections have no backgrounds; each is a transparent block with a horizontal gutter of clamp(1.25rem, 3.6vw, 4rem) and vertical padding measured in viewport height (10 to 20svh), so the scene always has room beside or behind the copy.

Copy is held to one narrow column (34rem) on the side the camera leaves empty: the scroll script moves the core right when text is left and left when the path list sits right. Dense lists (work, path) widen to a two-column hairline grid and push the core far back behind a veil. Facets are tall (78svh each) so one discipline holds the screen at a time; the inactive ones sit at 28% opacity and the one crossing the viewport centre comes to full.

Line lengths are capped in ch per role rather than by container. The top bar is fixed, hides on scroll down past half a viewport and returns on scroll up.

One breakpoint at 860px: the nav links drop (wordmark and LinkedIn remain), two-column rows stack, copy anchors to the bottom of each tall section, and the camera pulls back and lifts the core above the text. Touch and narrow devices get the lowest scene tier (fewer dust and portrait points, pixel ratio capped at 1.25).

**The Empty Side Rule.** Text and core never share the same half of the screen at full strength. Either the camera moves the core aside, or the veil comes up.

## Elevation & Depth

The DOM is flat: there is not one box-shadow in the stylesheet. Depth is real and belongs to the scene: perspective (32 degree lens), additive glass layered over an emissive core, restrained bloom (strength 0.34, rising briefly with each pulse), a vignette and fine grain. Layering in the page is four fixed planes: canvas, veil, content, top bar.

**The No DOM Shadow Rule.** Nothing in the page layer casts a shadow or glows. If something needs to stand off the scene, dim the scene.

## Shapes

Two forms only. Controls are full pills (999px) with a one-pixel hairline outline; everything else is square and unboxed, separated by one-pixel rules. The focus ring is a 2px Ice outline offset 4px with a 2px corner. Icons are two small stroked arrows (diagonal for external, down for in-page), 0.7em, stroke 1.4, round caps, drawn in the current text colour.

The scene's shapes echo this: circles (core, shells, rings, orbits) and low-polygon solids (icosahedron, octahedron, dodecahedron) for the four nodes.

## Components

### Buttons
- **Shape:** full pill (999px).
- **Primary:** Ink fill with Ground text, weight 650, padding 0.5rem 1.4rem. One per view (the Ask submit).
- **Hover / Focus:** fill shifts to Ice over 0.3s; focus shows the global Ice ring. While the agent run is busy, controls drop to 45% opacity and ignore input.

### Chips
- **Style:** transparent, Ink text at label size, one-pixel Line outline, padding 0.45rem 1rem. Used for suggested questions and for the follow-up jump link at the end of an answer.
- **State:** outline brightens to Ink on hover. No selected state exists.

### Cards / Containers
- **None.** Grouped content is a list of hairline rows: a top rule on the list, a bottom rule on each row, no fill, no radius, no padding box. Case rows are a 5fr / 6fr grid with the title spanning both text rows; path rows are a 9.5rem date column beside the place; run rows are a 6.5rem role column beside the body.

### Inputs / Fields
- **Style:** no box. Transparent field at 1.25rem on a one-pixel Ink 3 underline shared with its submit pill; placeholder in Ink 3; caret in Cyan.
- **Focus:** the underline shifts to Ice; the field's own outline is suppressed in favour of that line.

### Navigation
- Fixed top bar: condensed wordmark (760, width 72, 1.5rem) at left, five section links at label size, LinkedIn with a diagonal arrow pushed to the far right. Links rest at 86% opacity; hover and the current section go to full and draw a one-pixel underline from the left over 0.5s. Below 860px the section links are removed and nothing replaces them.

### Text Links
- **In-page action** ("See the work"): weight 650, arrow after the label, one-pixel Line underline. On hover the underline turns Ink and the gap to the arrow widens (0.6rem to 0.95rem).
- **Contact links:** the same behaviour at title size and condensed width.

### Agent Run (signature)
A scripted run rendered as hairline rows: You, Plan, Tool call, Answer. Each row enters by rising 0.6rem out of a 4px blur over 0.6s. Tool calls show Cyan monospace code, then an Ink 2 observation. The answer types in word by word at lead size. Every step pulses the core (brighter, bloom up, shells spin faster) and the plan step pulls the relevant node toward the camera; the node is released 2.6s after the run ends. With reduced motion the run prints at once.

### Scene Labels
Four plain label-size captions pinned to the four nodes in the first viewport, positioned from the 3D projection each frame, fading out near the headline and when the hero leaves.

### Motion
- **Ease:** cubic-bezier(0.16, 1, 0.3, 1) for every DOM transition that moves; plain 0.3s for colour and opacity.
- **Reveal:** rise 1.75rem out of a 6px blur over about 1s, staggered 0.08s per element entering together; plays once.
- **Intro:** scene swings in and scales up over 2.8s; headline lines rise from behind a mask (1.5s, 0.11s stagger); name line, action and top bar fade in after.
- **Scroll:** smoothed scrolling (lerp 0.11), anchor jumps take 1.6s; the camera eases toward each pose rather than snapping.
- **Pointer:** the camera leans a few degrees toward the cursor; ignored for touch.

## Do's and Don'ts

### Do:
- **Do** keep one persistent scene behind the whole page and move the camera, not the background.
- **Do** set headings in Archivo at width 70 to 78 and weight 720 to 780, and all reading text at width 100.
- **Do** separate grouped content with one-pixel Line rules and keep rows unboxed.
- **Do** use the full pill for every button: Ink-filled for the one primary action, outline for the rest.
- **Do** dim the scene with the Ground veil when dense text sits over it.
- **Do** cap line length per role (34 to 36ch lead, 54 to 62ch body).
- **Do** use the single ease-out curve for anything that moves, and keep every state visible under reduced motion.
- **Do** keep all copy in HTML above the canvas so the page reads without WebGL.

### Don't:
- **Don't** add box-shadows, glows or gradient fills to DOM elements; the light belongs to the scene.
- **Don't** put copy in filled cards or panels.
- **Don't** use Cyan or Violet as interface colours beyond the caret and tool-call code.
- **Don't** introduce a warm hue in the page layer, or a second typeface.
- **Don't** set text in uppercase or add letter-spacing to small text.
- **Don't** set running text in the condensed width.
- **Don't** place full-strength copy over the core without moving the core aside or raising the veil.
