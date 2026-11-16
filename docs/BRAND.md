# Brand

`insurer` should feel like a clear, considered case file: warm paper, confident typography, and precise financial details. Use generous space and a restrained editorial style so the claim, evidence, and decision remain the focus.

## Fonts

From Google Fonts:

- **Headings**: Space Grotesk, medium or semibold. Use sentence case and compact line spacing.
- **Body and interface**: Manrope, regular or medium. Keep paragraphs short and line lengths comfortable.
- **Accent (a short introduction or quote)**: Newsreader, italic. Use sparingly, outside forms and financial tables.
- **Code, money and identifiers**: IBM Plex Mono. Align numbers to the right in tables and preserve decimal alignment.

Use no more than three font families on one screen: Manrope and IBM Plex Mono form the foundation; choose Space Grotesk or Newsreader as the additional voice. Use system sans-serif, serif, and monospace fallbacks respectively.

## Colors

- **Primary**: Cobalt `#3048A5`, white text. Use for the main action, active navigation, and selected controls.
- **Secondary**: Terracotta `#A54730`, white text. Use for a secondary chart series or a warm editorial accent.
- **Tertiary**: Mulberry `#75456F`, white text. Use for a third comparison series or a distinct category.
- **Information**: Deep Teal `#176A73`, white text. Use for contextual notes and supporting information.
- **Highlight or warning**: Saffron `#E8B44C`, Ink text. Use for missing evidence, pending review, and details requiring attention.
- **Error**: Carmine `#B3324A`, white text. Reserve for failures and destructive actions.
- **Ink on light backgrounds**: Ink `#202735`.
- **Ink on dark backgrounds**: Linen `#F2EFE9`.
- **Secondary text**: Slate `#5C6575` on light surfaces; Silver `#B5BECC` on dark surfaces.

For model comparisons, use Cobalt, Terracotta, and Mulberry in that order. Add Deep Teal fourth and Saffron fifth. Keep each model's color consistent across charts and tables.

For decision states, use Deep Teal for `approve`, Carmine for `decline`, and Saffron for `refer`. Always include a text label; color alone must not carry the decision. A model's confidence is a separate measure and must not appear as a guarantee of correctness.

## Surfaces

- **Light mode**: page background Parchment `#F5F2EC`, white panels `#FFFFFF`, and inset areas `#ECE8E0`.
- **Dark mode**: page background Night `#151B26`, panels `#202938`, and inset areas `#293447`.

Use 16px corners for cards and 10px corners for inputs and buttons. Group related content with spacing and surface changes. Keep shadows soft and limited to elevated elements; use a subtle full outline only when a control or dense table needs definition.

Use Ink for headings on light surfaces and Linen on dark ones. For links and small accents on dark surfaces, use Periwinkle `#B5C3FF` instead of Cobalt, Clay `#F2B09A` instead of Terracotta, and Heather `#DDB7D7` instead of Mulberry. Deep Teal becomes Aqua `#91D3CF` for small text on dark surfaces. Saffron is a background highlight with Ink text, not a small-text color on white.

Keep keyboards usable: show a visible focus ring, preserve clear hover and selected states, and check final text contrast at the actual font size.

## Avoid

- Colored strips along a single card edge and decorative rules across page headers.
- Large gradient backgrounds, glass effects, neon accents, and heavy shadows.
- An entire dashboard of rounded pills, oversized metric tiles, or equally emphasized actions.
- All-caps paragraphs, decorative fonts in tables, and truncated claim identifiers.
- Using approval colors for model confidence or presenting a recorded decision as a completed payment.
- Company branding or former repository names. `insurer` is the project name; UnderCover Travel Insurance remains the scenario name in the course prompts and data.

## Tone

Plain business English in US spelling. Use short labels, concrete verbs, and calm explanations. Avoid jargon, exclamation marks, and claims that the model is always correct.

Write money in US dollars with thousands separators and two decimals: `$1,250.00`. Preserve identifiers exactly, such as `CLM-1001` and `POL-2001`. Use consistent decision labels: Approve, Decline, and Refer; keep their stored values lowercase.

Explain what happened and what comes next. Prefer “Decision recorded” to “Claim paid.” Distinguish model recommendations, reference decisions, and tool confirmations wherever they appear together.
