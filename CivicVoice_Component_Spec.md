CivicVoice: Implementation Spec (Antigravity/CSS)

Global CSS Variables

:root {
  --bg-raw: #FBFBFA;
  --text-main: #0D1111;
  --truth-emerald: #059669;
  --caution-amber: #D97706;
  --border-weight: 2px;
  --font-serif: 'Fraunces', serif;
  --font-body: 'Newsreader', serif;
  --font-data: 'JetBrains Mono', monospace;
}


Component: The "Witness Card"

Border: 2px solid var(--text-main).

Corner Radius: 0px (Strict Brutalism) or 4px (Modern Refined). Let's use 4px.

Interaction: On hover, the border expands to 4px and the "Emerald Stamp" icon pulses.

Animation: Use cubic-bezier(0.16, 1, 0.3, 1) for all transitions. It creates a "snappy" feeling common in premium luxury apps.

Component: The "Witness Cam" UI

Background: #000000.

Overlay: A subtle "film grain" SVG texture to add atmosphere and depth.

Controls: Oversized circular buttons with heavy borders.

Visual Feedback: A real-time "Waveform" for audio that turns from White to Emerald when a "Presence Lock" (GPS) is achieved.

Component: The "Amnesia Audit"

A dedicated section in the user profile that uses a "Digital Terminal" look.

Uses a scanning animation that visually "ticks off" items:

[OK] IP LOG PURGED

[OK] SESSION ROTATED

[OK] METADATA STRIPPED

Aesthetic Goal: Make the user feel like they are inside a high-security vault.