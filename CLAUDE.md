# Artha-IQ (WealthIQ repo)

Personal finance app for salaried professionals in India, by Pithonix AI. Static HTML pages at the root (`index.html`, `app.html`, the calculators) deploy to Vercel. `server.js` (Express) is the API, which runs on Railway; `vercel.json` sends `/api/*` there.

- Legal name in formal documents: PITHONIX AI INDIA PRIVATE LIMITED. Use "Pithonix AI" elsewhere.
- No em dashes in copy, comments or documents. Short, warm, plain sentences.
- Payments are switched off until launch (kill switch). Do not turn them back on without the founder.

## Motion (reanimate skill, added 2026-11-25)

The `reanimate` skill is installed at `.claude/skills/reanimate/` (MIT). It films a reference animation, rebuilds it here, films the copy the same way, and compares the two until timing and easing match. Run: `/reanimate <what>, <where it is>, <where it goes>`.

- Build in plain CSS and JS, no animation library. Use the shared Pithonix motion kit in `pithonix-repo-library/motion/` for timings.
- Copy timing and feel only, never another brand's shapes, colours, images or wording.
- `index.html` has no `prefers-reduced-motion` rule today. Add one with the first motion change.
- Evidence goes in `.reanimate/<name>/` (git-ignored). `.claude/` is in `.vercelignore`, so skills are never deployed.

## Design skills (Hallmark, Impeccable, Taste Skill, added 2026-11-25)

Installed at `.claude/skills/hallmark/`, `.claude/skills/impeccable/` and `.claude/skills/design-taste-frontend/` (Taste Skill). They are snapshots from `pithonix-repo-library`; update them with its `scripts/install-skill.sh`, never by hand.

- **This file wins.** The theme, fonts, writing rules and any canonical figures in this file beat every skill's defaults. The skills sharpen our design, they never replace it.
- **Which one when:** Hallmark for a brand new page. Impeccable to refine or audit an existing page (`/impeccable audit`, `polish`, `quieter`, `typeset`). Taste Skill to check that a new marketing page fits the business, in a real browser. reanimate for motion. When they disagree: Hallmark leads on the look of new pages, Impeccable on refinements, Taste Skill on fit to the business.
- **No redesign of a live page** unless the founder asks for one. A refinement keeps the current look, copy and layout.
- **Background checks:** Taste Skill runs a check when Claude finishes a turn while it is in use, and it can take a few minutes. Impeccable offers a check after every edit: answer no unless the founder has agreed. Impeccable downloads its engine on first use into `scripts/bin/`, which is git-ignored.
- **Working files:** `.taste-skill/` and `.impeccable/` may be committed. They stop consecutive designs from looking the same.
- Hallmark's image generation needs a paid Together AI key. It stays off unless the founder provides one.
