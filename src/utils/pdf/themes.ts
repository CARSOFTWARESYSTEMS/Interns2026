// ── Template Theme Presets (PEOPLE-003) ──────────────────────────────────────
// A shared layout engine (see letterPdf.ts) renders every theme — themes are
// small preset tweaks (corner radius, card density, which brand color drives
// section headings) layered on top of the template's own brandColors, not
// six independently-built layouts.

import type { TemplateTheme, TemplateBrandColors } from '../../types/peopleLetters'

export interface ThemePreset {
  cornerRadius: number                    // mm, rounded-rect corner radius for cards
  cardFillOpacity: number                 // 0–1, how much brand color is mixed into the lightGray card base — small on purpose, cards are meant to read as pale/neutral with a hint of brand color, not a solid brand-colored block
  headingColorKey: keyof TemplateBrandColors  // which brand color drives section headings
  rule: boolean                           // draw a divider rule under the masthead
}

export const THEME_PRESETS: Record<TemplateTheme, ThemePreset> = {
  classic:   { cornerRadius: 0,   cardFillOpacity: 0.07, headingColorKey: 'navy',      rule: true  },
  corporate: { cornerRadius: 1.5, cardFillOpacity: 0.09, headingColorKey: 'secondary', rule: true  },
  premium:   { cornerRadius: 3,   cardFillOpacity: 0.11, headingColorKey: 'primary',   rule: false },
  aerospace: { cornerRadius: 0.5, cardFillOpacity: 0.09, headingColorKey: 'secondary', rule: true  },
  defence:   { cornerRadius: 0,   cardFillOpacity: 0.08, headingColorKey: 'navy',      rule: true  },
  minimal:   { cornerRadius: 2,   cardFillOpacity: 0.05, headingColorKey: 'navy',      rule: false },
}
