# ainosbase — Feature Roadmap & Task List

A working roadmap for settings/features work on ainosbase.gr. Read `AGENTS.md` first for operating conventions. This file is the source of truth for **what is done, what is in progress, and what is next**. Update statuses here as work proceeds — do not start from scratch on a feature that is already completed or in flight.

## Status legend
- ✅ **Done** — shipped to prod. Linked PR/commit.
- 🚧 **In progress** — exactly one at a time. Agent has claimed this.
- ⏳ **Queued** — next up, scoped, ready to start.
- 💤 **Parked** — captured for later; not scoped; not soon.

## How to use this doc
1. Read `AGENTS.md` for guardrails.
2. Find the first non-✅ task in the "Active queue" below.
3. If a task is 🚧, check with Tim before starting — someone may be mid-flight.
4. When starting a task, flip its status to 🚧, branch `feat/<task>`, and update the "Decision log".
5. When done: flip to ✅, link the PR, run AGENTS §14 checks, and tick off the acceptance criteria.

---

## Already shipped (context, do not redo)

### ✅ Font switcher — `/settings` page
- Three Greek-capable Google Fonts: **Sofia Sans** (default), **Manrope**, **Alegreya Sans**.
- `localStorage` persistence, survives reload/navigation/browser restart.
- Early `<head>` inline script sets `--ainos-font` on `:root` before paint (no FOUC).
- "Settings" link in nav on home, search, hymn list, hymn show, presenter.
- Presenter/present views deliberately **pin to Sofia Sans** — slides are a projection surface, consistency matters there. Do not extend the font switcher to slides.
- PR: https://github.com/timcoomar/ainosbase/pull/1  (merge commit `f73994b`)
- Follow-up note: `AGENT_BRIEFING.md` at repo root is the working draft that produced `AGENTS.md`. It is intentionally **not** committed to git — it is a local working artifact; do not commit it.

---

## Active queue — work these in order

### #1 ✅ Default lyrics view on hymn show page (Greek / English / Both) — DONE
**Shipped.** PR https://github.com/timcoomar/ainosbase/pull/2 (merge commit on main).
- Settings page has a "Default lyrics view" control alongside the font switcher.
- Hymn show page renders both `greek_lyrics` and `english_lyrics` server-side (English was previously invisible — content-surfacing gap now closed).
- Per-visit segmented toggle on the show page (GR / EN / GR+EN) flips view without a round-trip and persists as the new default.
- Both mode: stacked (Greek above English). Side-by-side on desktop deferred.
- Copy-to-clipboard copies whichever lyrics are visible.
- Early inline script sets `html[data-lyrics-view]` from `localStorage.ainos_lyrics_view` before paint.

**Decisions confirmed (see Decision log):** `alternate_translation` off v1; YouTube embeds + greek_chords link remain visible in every lyrics mode.

**Goal.** Let a user choose their default lyrics presentation on the hymn show page: Greek only, English only, or both. Default applies on every hymn page; per-visit override is one click without leaving the show view.

**Full scope.**
- Add a settings control on `/settings` (alongside the font switcher) for `default_lyrics_view` with three options: `greek` (default), `english`, `both`. Persist via `localStorage` using the same pattern as `ainos_font` (suggested key: `ainos_lyrics_view`).
- Extend the early inline `<head>` script in `layout.antlers.html` to read `ainos_lyrics_view` and set a data attribute or body class (e.g. `data-lyrics-view="both"`) before paint — so the show page renders the right view first time, no flash.
- Redesign `resources/views/hymns/show.antlers.html` to render **both** `greek_lyrics` and `english_lyrics` on the server (Antlers can output both; JS/CSS controls which is visible based on the active view). Recommended markup: two `<section>`s with classes `lyrics-greek` and `lyrics-english` inside the existing `.greek-version` (rename to `.hymn-lyrics` to avoid confusion).
- Add a per-visit toggle on the hymn show page (small segmented control: `GR / EN / GR+EN`). Clicking flips `data-lyrics-view` on the page and (optionally) writes the choice to localStorage as the user's new default — recommended so the choice "sticks" across navigation, mirroring the font switcher's behaviour.
- "Both" layout: stack Greek above English (single column, mobile-friendly). Side-by-side on desktop (≥700px) is a nice-to-have — **stacked only is acceptable for v1**; do side-by-side only if it's cheap.
- English-only mode: hide the Greek `<section>` cleanly. Do **not** strip it from the DOM (the toggle needs to flip back without a server round-trip).
- Copy-to-clipboard button on the show page currently operates on `#greekLyrics`. Extend to copy whichever view is active. If "both", copy Greek + a blank line + English.
- Decide and document (Decision log): does "both" also surface `alternate_translation` if present? **Proposal: no for v1** — keep the alternating-translation field off the public show page; surface it later if requested.
- Decide (Decision log): does english-only mode still show `youtube_greek` embeds? **Proposal: yes** — the youtube blocks are supplementary media, not lyrics; keep them visible regardless of lyrics view. `youtube_english` is intended for an English context, so both embeds are valid in any lyrics mode.
- Decide (Decision log): should `greek_chords` link stay visible in english-only mode? **Proposal: yes** — chords are not language-locked; the link to the PDF is just another asset on the page.

**Files likely affected.**
- `resources/views/hymns/show.antlers.html` — redesign lyrics section, add the segmented toggle, render both lyrics server-side
- `resources/views/settings.antlers.html` — add a "Default lyrics view" control (radio/segmented) alongside the font cards
- `resources/views/layout.antlers.html` — extend the early inline script to read `ainos_lyrics_view` and set `data-lyrics-view` on `<body>` (or `:root`)
- `resources/css/partials/_hymn.scss` — new styles for the segmented toggle, both-lyrics layout (stacked by default, side-by-side on desktop if doing that)
- `resources/css/partials/_settings.scss` — styles for the new lyrics-view control (mirror the font-option look for consistency)
- `resources/js/site.js` — small module for the per-visit lyrics toggle on the show page (initialise from `data-lyrics-view`, swap on click, persist to localStorage)

**Acceptance criteria.**
- [ ] Settings page offers a "Default lyrics view" control with three options (Greek / English / Both); choice persists via `localStorage` and survives reload/navigation/browser restart.
- [ ] Hymn show page renders the user's chosen view by default, on first paint (no flash of the wrong language).
- [ ] Hymn show page exposes a per-visit segmented toggle (GR / EN / GR+EN) so the user can flip without going to Settings.
- [ ] "Both" mode shows Greek above English (stacked). Side-by-side on desktop is optional.
- [ ] "English" mode hides Greek; "Greek" mode hides English. Toggling between views does not reload the page.
- [ ] Copy-to-clipboard button copies whichever lyrics are currently visible (Greek, English, or both).
- [ ] YouTube embeds and chord PDF links remain visible in every lyrics mode.
- [ ] All pages still return 200 locally; `vendor/bin/pint --dirty` clean; `php artisan test` passes; `php artisan route:list` unchanged.
- [ ] Shipped via `feat/lyrics-view` branch → PR → merge. Do not push to `main` directly (this is code work, AGENTS §8).

**Where to start.**
1. Confirm/adjust the three Decision-log proposals above with Tim.
2. Branch `git checkout -b feat/lyrics-view` off `main`.
3. First commit: refactor `show.antlers.html` to render both lyrics server-side (no JS yet) so the English content is at least present in the DOM. Manually verify the existing Greek-only rendering still works with `data-lyrics-view="greek"` set.
4. Then add the settings control + early inline script extension.
5. Then add the per-visit toggle JS.
6. Then the layout/CSS polish (both-mode stacked, optional side-by-side).
7. Last: copy-to-clipboard behaviour.
8. Run AGENTS §14 checks, open PR.

**Dependencies.** None. Can start immediately.

---

### #2 ✅ Setlist persistence (save / load / recall) — DONE
**Shipped.** PR https://github.com/timcoomar/ainosbase/pull/3 (merge commit `66f57ff` on main); retriggered by `chore(deploy)` commit `83c45af` after a GitHub Actions runner queue stall.
- "Αποθήκευση λίστας" button next to "Έναρξη Παρουσίασης" saves the current base64 payload to `localStorage.ainos_setlists` keyed by a user-chosen name.
- Saved-setlists panel below the builder grid lists entries (name, count, timestamp) with three actions:
  - **Φόρτωση** — dispatches `load-setlist` Livewire event; `PresenterBuilder::loadSetlist()` decodes the payload and replaces the in-builder state.
  - **Παρουσίαση** — opens `/presenter/present#<payload>` in a new tab.
  - **×** — delete (with confirm).
- Cap of 20 saved entries; overwrite warning if name exists.
- The panel lives inside the root `.presenter-builder` div wrapped in `wire:ignore` (Livewire single-root constraint satisfied).

**Follow-up for Tim (not blocking):** a procedural exception was made — an empty direct-to-`main` commit to retrigger the deploy (GitHub Actions queue was stuck ~1h27m). Consider (a) adding `workflow_dispatch:` to `deploy.yml` so deploys can be retried without touching `main`, or (b) a small carve-out in AGENTS.md for empty `chore(deploy):` retrigger commits.

**Goal.** Named, localStorage-persisted setlists the user can save from the builder and recall later — including from past weeks.

**Scope (high level — full scope to be drafted when this becomes 🚧).**
- Add a "Save setlist" action in `presenter/builder.antlers.html` that prompts for a name and writes the current setlist to `localStorage` under a key like `ainos_setlists` (an object keyed by name → `{hymns, lang, saved_at}`).
- Add a "Recall setlist" panel: list of saved setlists (name, date, count), click to load, delete button per item.
- One-click "last setlist" restore as a convenience shortcut.
- No backend — purely client-side. Same pattern as font switcher.
- Capacity: cap at, say, 20 saved setlists; warn before overwriting an existing name.

**Files likely affected.**
- `resources/views/livewire/presenter-builder.blade.php` — UI for save/recall panel
- `app/Livewire/PresenterBuilder.php` — possibly add save/recall methods (but localStorage is client-side — may need a JS-only approach instead; decide during scoping)
- `resources/js/site.js` or a new `resources/js/presenter-builder.js` — setlist persistence module
- `vite.config.js` — wire the new JS entry if one is created
- `resources/css/partials/_presenter.scss` — styles for saved-setlist panel

**Acceptance criteria (draft).**
- [ ] Build a setlist → click "Save" → name it → it appears in a saved list
- [ ] Reload the page → the saved list is intact
- [ ] Click a saved setlist → it loads into the builder
- [ ] Delete a saved setlist → it disappears
- [ ] Cap + overwrite warning works as expected
- [ ] AGENTS §14 checks pass; shipped via `feat/setlist-persistence` → PR

**Dependencies.** None — but it's worth doing after #1 so the settings page is already a "preferences" surface and the localStorage pattern is well-trodden in the codebase.

---

### ✅ Copy button refresh (interstitial task) — DONE
**Shipped.** PR https://github.com/timcoomar/ainosbase/pull/6 (merge commit on main, 21:30 2026-07-25).
- Discrete icon-led control: clipboard SVG + label "Αντιγραφή στίχων" at small caption type (0.78rem, low opacity until hover, thin border + bg on hover). Matches the GR/EN/GR+EN toggle and Save button visual language.
- Writes **both** `text/html` (preserves `<p>` + `<em>` for rich paste targets) **and** `text/plain` (for plain-text editors). Falls back to `navigator.clipboard.writeText` on browsers that reject `ClipboardItem`.
- Plain-text builder walks `<p>` children of each visible lyrics block, joins verses with `\n\n`, Greek and English separated by blank line in GR+EN mode.
- Visible transient feedback: "Αντιγράφηκαν στίχοι" chip on success, "Αποτυχία" on failure; auto-hides after 2s. `role=status` + `aria-live=polite` for screen readers.
- Respects active lyrics view (Greek / English / Both).
- Extracted into dedicated `initCopyLyricsButton` initialiser, out of `initLyricsToggle` (cleaner separation; was shoehorned in during #1).
- Removed the catch-all `button { ... }` styling in `_hymn.scss` (was shimming old icon with `top: 4px`); replaced with focused `.copy-lyrics-btn` + `.copy-feedback` rules.
- Old `.copy-btn` and `copy.svg` references on the show page are gone. The `.svg` file itself in `content/assets/` is untouched.

---

### #3 ⏳ Favourites / personal shortlist
**Problem.** A pastor returns to the same ~30 hymns out of a growing catalog. Scrolling the full list every time is friction.

**Goal.** Star toggle on hymn cards (list + show page); "My hymns" filter on the list and search.

**Scope (high level).**
- `ainos_favourites` in localStorage = array of slugs.
- Star toggle component on `hymns/index.antlers.html` and `hymns/show.antlers.html`.
- Filter control on list page: All / Favourites.
- Optional: search scope "Favourites only" — depends on whether the Livewire live-search addon allows custom filtering; may need a separate search route or a client-side post-filter.

**Files likely affected.**
- `resources/views/hymns/index.antlers.html` — star toggle + filter
- `resources/views/hymns/show.antlers.html` — star toggle
- `resources/js/site.js` — favourites module
- `resources/css/partials/_hymn.scss` — star styling
- Possibly `app/Livewire/Counter.php` style wrapper if a Livewire toggle is preferred to vanilla JS (decide during scoping)

**Acceptance criteria (draft).**
- [ ] Star a hymn from list or show page → slug stored in localStorage
- [ ] List page filter shows only starred hymns when active
- [ ] Favourites survive reload and return visits
- [ ] AGENTS §14 checks pass; shipped via `feat/favourites` → PR

**Dependencies.** None technically, but **genuine value scales with catalog size**. Recommend **not starting until the catalog is ≥40 hymns** (currently 17). At 17, the full list fits one scroll and favourites adds friction without payoff. Flag to Tim when a batch import brings the count past 40.

---

### #4 ⏳ Text size / reading scale
**Problem.** No way to enlarge body text for accessibility. Audience skews older.

**Goal.** Three-step text scale (S/M/L) or a slider; persists via localStorage; affects hymn show + list, not slides.

**Scope (high level).**
- Add a `--text-scale` CSS custom property on `:root`, default `1`.
- Settings control: three buttons or a range input.
- Apply scale by using `font-size: calc(<base> * var(--text-scale))` on `body` (or multiply `html` font-size so rem-based sizing flows through).
- Persist in `localStorage` as `ainos_text_scale`.
- Early inline `<head>` script sets the variable before paint (same pattern as font switcher).

**Files likely affected.**
- `resources/views/settings.antlers.html` — new control alongside font + lyrics-view
- `resources/views/layout.antlers.html` — extend early inline script
- `resources/css/site.scss` — wire `--text-scale` into `body` font-size
- `resources/css/partials/_settings.scss` — styles for the new control

**Acceptance criteria (draft).**
- [ ] Settings page offers a text-scale control (3 steps or slider)
- [ ] Choice persists and survives reload/navigation/browser restart
- [ ] No FOUC on first paint
- [ ] Slides (presenter/present) are unaffected — pinned font + scale
- [ ] AGENTS §14 checks pass; shipped via `feat/text-scale` → PR

**Dependencies.** None. Can be done independently of #1–#3; the settings page simply grows by one control per feature.

---

## Parked — captured, not soon

### 💤 #5 Dark mode
Genuine but generic. Useful for evening service prep / dim rehearsals. Comfort item, not pressing. Scope later if requested.

### 💤 #6 Default language for presenter
The presenter builder already has a `greek / english / both` control — this would just persist the last-used selection as a default. Saves two clicks per session. Low impact; revisit if the builder gets other ergonomic improvements.

### 💤 #7 Print stylesheet for hymns
A "Print" button that triggers a print-optimised view (no nav, no chords link, just lyrics + title). Useful for paper service bulletins. Minority use case; low priority until paper-based workflows surface.

### 💤 #8 Search scope filter
"All / Greek only / English only / Favourites only" on the search input. Low value at current catalog size; becomes medium at 100+ hymns. Premature now; revisit after #3 (favourites) and once the catalog grows.

---

## Decision log
- **Slides font policy (2026-07-25):** Presenter/present views pin to Sofia Sans deliberately. The font switcher is a reading-experience setting and does not extend to the projection surface. Documented in `AGENTS.md` companion material. Do not extend the switcher to slides without Tim's explicit approval.
- **#1 three sub-decisions CONFIRMED (2026-07-25):**
  1. `alternate_translation` field: **off** the public show page for v1. Document and revisit if requested.
  2. YouTube embeds: **stay visible** in every lyrics mode (supplementary media, not lyrics).
  3. Greek chords PDF link: **stays visible** in every lyrics mode (not language-locked).
- **#1 "both" layout (proposed):** stacked (Greek above English) for v1. Side-by-side on desktop is optional second-pass polish, not blocking.
- **#3 trigger:** don't start until catalog ≥40 hymns (currently 17). Re-evaluate after each batch import.
- **#4 priority:** accessibility win for audience that skews older. Worth doing but can wait its turn after #1–#3.
- **Pattern for all settings:** localStorage + early inline `<head>` script sets a CSS custom property / data attribute before paint → no FOUC. Every new setting should follow this pattern unless there's a backend reason not to.