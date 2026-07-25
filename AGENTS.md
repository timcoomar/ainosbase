# AGENTS.md — Operating Guide for AI Agents on ainosbase.gr

Read this entire file before touching the repository. Every section exists because something in this setup is subtle or load-bearing.

---

## 1. Project at a glance

**ainosbase.gr** is a Statamic 6 (Laravel 12) flat-file CMS site for Greek hymns and worship songs: lyrics in Greek with parallel English, optional chord PDFs, in-browser search, and a Livewire "presenter" setlist builder.

- **Live URL**: https://ainosbase.gr
- **Prod host**: Hetzner CAX11, Ubuntu 24.04 ARM64, Nginx + PHP-FPM, user `deploy`, site at `/var/www/ainosbase.gr`
- **Stack**: PHP ^8.2, Laravel ^12, Statamic ^6, Livewire, Vite ^6, Tailwind ^3.4, Antlers templates (one Blade view for the presenter)
- **Content model**: flat-file Markdown in `content/` — primarily the `hymns` collection; one `.md` per song
- **This is the only project doc.** If anything here is ambiguous, flag it to Tim and ask before acting.

---

## 2. Two-axis workflow (read this twice)

This site separates code from content, and each flows in the **opposite direction**:

| Axis | Where it's edited | How it reaches prod | How it reaches your local |
|---|---|---|---|
| **Code** | Local machine | Push to GitHub `main` → GitHub Actions SSHes prod, pulls, rebuilds (`.github/workflows/deploy.yml`) | You pull `main` |
| **Content** | Statamic CP on prod | Auto-synced: hourly cron `content-sync.sh` commits `content/` + `users/` and pushes; deploy script also commits-and-rebases before pulling | You pull `main` |

**Implications:**
- `main` is live. Pushing to `main` deploys within ~30 seconds.
- Content files (`content/`, `users/`) on your local machine are a snapshot — never edit them casually; the server is the source of truth and will overwrite via auto-sync.
- The deploy script's pre-pull choreography (`git add content/ users/ && commit && pull --rebase && push`) is what keeps concurrent CP edits from being clobbered. Don't break it.
- `git pull` on your local may surface content commits you didn't make — that's expected. `git pull --rebase` is the default-safe local pull.

### The one standing exception: batch content imports
Occasionally (~50+ hymns at a time) an agent may author new hymns locally and push them to `main`. This is **additive content-only** — creates new files, never modifies existing ones. See §6 for the full safeguard protocol.

---

## 3. Local dev

```bash
# First-time setup (deps already installed in this checkout):
cp .env.example .env && php artisan key:generate   # only if .env missing
composer install && npm ci && npm run build

# Run the site:
php artisan serve --port=8000                       # http://127.0.0.1:8000
npm run dev                                          # hot CSS/JS — optional, only if editing styles/scripts
```

- `.env` ships wired for MySQL (`DB_CONNECTION=mysql`, db `laravel`, user `root`), but **Statamic content is flat-file** — hymns and pages render regardless of whether MySQL is running. Only `users/` and sessions need the DB.
- `STATAMIC_STACHE_WATCHER=true` locally → Statamic auto-reindexes content on file change. If a change doesn't appear, run `php artisan stache:clear`. **Never run `stache:clear` on prod** — it happens via the deploy pipeline.
- Static caching is `null` (off). API and GraphQL are disabled. Revisions are off. See §9 for why.
- Prebuilt assets live in `public/build/`; the site renders without Vite running.

---

## 4. Architecture map

```
app/
  Livewire/{Counter,Livesearch,PresenterBuilder}.php   # Livewire components
  Http/Controllers/Controller.php                        # scaffold only
  Models/User.php
  Providers/                                            # Laravel + Statamic service providers

content/                                  # flat-file content (source of truth on prod)
  collections/
    hymns/                                # one .md per hymn; slug-derived filename
      hymns.yaml                          # collection config: route, mount, template
      *.md                                 # e.g. aionios-theos.md
    pages/
      home.md, ymnoi.md                   # ymnoi IS the hymns mount — see §5
  trees/, globals/, taxonomies/, navigation/, assets/

resources/
  blueprints/collections/hymns/hymn.yaml  # field schema for a hymn
  views/
    layout.antlers.html                   # global layout (Antlers)
    home.antlers.html, default.antlers.html, search.antlers.html
    hymns/{index,show}.antlers.html       # hymn list + single
    presenter/{builder.antlers.html, present.blade.php}   # only Blade view in the site
    partials/_nav.antlers.html
    livewire/presenter-builder.blade.php
    errors/404.antlers.html
  css/
    site.scss                            # entry; @imports partials below
    partials/{_home,_hymn,_nav,_normalize,_presenter,_reset,_search}.scss
  js/{site.js, presenter.js, cp.js, components/fieldtypes/ExampleFieldtype.vue (stub)}

routes/
  web.php                                # Statamic template routes + /api/hymns + /presenter/*

config/                                  # Laravel + Statamic config
scripts/server-setup.sh                  # one-time fresh-server provisioning
users/                                   # Statamic users — server-curated, do not edit locally
.github/workflows/deploy.yml             # push-to-main → deploy
```

### Routing
- `Route::statamic('ymnoi/search', 'search')` and `Route::statamic('search', 'search')` — Statamic template routes
- `Route::statamic('presenter', 'presenter/builder')` — setlist builder
- `Route::get('/presenter/present', fn => view('presenter.present'))` — the only hand-rolled non-Statamic view route, and the only Blade view in the repo
- `Route::get('/api/hymns', ...)` — hand-rolled Laravel route returning all hymns as JSON keyed by slug. This is **not** the Statamic REST API (which is disabled). Edit here for hymn API work.
- Hymn URLs: `{mount}/{slug}` where mount = the `ymnoi` page entry.

---

## 5. Load-bearing UUIDs and the mount contract

`content/collections/hymns.yaml` records `mount: 79f76961-7256-4425-a401-6304ac040e66`. That UUID is the `id:` of `content/collections/pages/ymnoi.md`. Every hymn URL is built from it.

- **Never** edit the `id:` of `pages/ymnoi.md`. Doing so breaks every hymn URL on the site.
- The hymn collection's `route: '{mount}/{slug}'` and the show template binding depend on this mount remaining stable.
- `greek_lyrics` and `slug` are `localizable: true` → they are the master copy shared across localizations (no multi-site is configured beyond this). `english_lyrics` is the per-locale variant. Adding new localisations requires Statamic multi-site wiring — out of scope unless Tim asks.

---

## 6. Content conventions

### Field requirements (per `resources/blueprints/collections/hymns/hymn.yaml`)
- **Required**: `title`, `greek_lyrics`
- **Always include by convention**: `english_lyrics` (all 16 existing hymns have it, even though the blueprint marks it optional)
- **Optional**: `greek_chords`, `english_chords`, `alternate_translation`, `youtube_greek`, `youtube_english`

### Filename and slug conventions
- Slugs are **transliterated Greek (Greeklish)** in Latin chars: `aionios-theos`, `agios-o-theos-agios-isxyros`. **Never use Unicode Greek in filenames or `slug:`** — routing and the search index expect ASCII.
- Filename = `{slug}.md`.

### Lyric formatting
- Verses numbered `1`, `2`, `3...`
- Chorus wrapped in `_..._` (markdown italic)
- Use `content/collections/hymns/aionios-theos.md` as the reference template — mirror its structure exactly or the `show.antlers.html` rendering looks wrong.

### Frontmatter shape (new hymn)
```yaml
---
id: <fresh UUIDv4>                       # generate via `php artisan tinker` Str::uuid() or `uuid -v4`
blueprint: hymn
title: '<Greek title>'
greek_lyrics: |-
  1 ...
  _chorus..._
  2 ...
english_lyrics: |-
  1 ...
  _chorus..._
  2 ...
# optional:
# greek_chords:
#   - greek-chords/<file>.pdf            # see asset contract below — file MUST exist first
# english_chords:
# alternate_translation:
# youtube_greek: 'https://...'
# youtube_english: 'https://...'
updated_by: <user UUID>                    # optional — Statamic populates on first CP save if omitted
updated_at: <unix timestamp>              # optional
---
```

### Asset container contract (chord PDFs)
- `greek_chords` field: `mode: list`, `container: assets`, `restrict: true`, `folder: greek-chords`.
- Chord PDFs **must** be placed in the `assets` container under `greek-chords/` before they are referenced in frontmatter. Writing `greek_chords: greek-chords/foo.pdf` without the file present produces a broken asset reference that renders blank in the show view.
- For batch imports that include chord PDFs: upload to `content/assets/greek-chords/` first, then write the frontmatter reference.

---

## 7. Deploy pipeline (do not break)

`.github/workflows/deploy.yml` fires on every push to `main`:
1. SSH into `deploy@195.201.216.32` using `secrets.SSH_PRIVATE_KEY` (stored in GitHub Actions secrets).
2. If `content/` or `users/` have pending CP changes on the server: `git add content/ users/ && commit && pull --rebase && push` — auto-rebasing server-side edits onto the incoming push.
3. `git checkout -- .` to discard any other local drift (e.g. `package-lock.json`).
4. `git pull origin main`.
5. `composer install --no-dev --optimize-autoloader` (dev packages absent on prod — don't write runtime code that depends on them).
6. `npm ci && npm run build`.
7. `php artisan cache:clear` + `php artisan statamic:stache:clear`.

A separate hourly cron on the server (`content-sync.sh`, provisioned by `scripts/server-setup.sh`) commits/pushes `content/` + `users/` changes on its own schedule.

**Implications for agents:**
- `main` is live. Pushing to `main` triggers a deploy within ~30 seconds.
- **Never `git push --force` or `--force-with-lease`** — it breaks the server's auto-rebase path.
- **Never rebase `main`** — same reason.
- Avoid pushing at the top of the hour (the `content-sync.sh` cron fires at :00). Push at :05–:55 if it matters.

---

## 8. Branch strategy

- **Code changes**: `feat/*` or `fix/*` branch → PR → merge to `main`. Merge triggers deploy. This protects against an agent's broken commit going live.
- **Content batches**: direct push to `main` is allowed, because they are additive (new files only) and a PR adds no review value. Still subject to all batch-import safeguards in §10.
- **Commit prefixes**: `content(batch):`, `fix(presenter):`, `feat(hymns):`, `chore(deps):`, `docs(agents):`.

---

## 9. Statamic engine behaviour — do not change without Tim's approval

- **Stache watcher**: on locally (`STATAMIC_STACHE_WATCHER=true`). Auto-reindexes on file change. On prod, `stache:clear` runs via deploy only — never run it against prod manually.
- **Static caching**: `null` (off). **Do not enable** `STATAMIC_STATIC_CACHING_STRATEGY` without Tim's approval and an invalidation plan — enabling blindly serves stale pages while content auto-syncs from the CP.
- **REST API + GraphQL**: disabled (`STATAMIC_API_ENABLED=false`, `STATAMIC_GRAPHQL_ENABLED=false`). `/api/hymns` in `routes/web.php` is a hand-rolled Laravel route, **not** the Statamic REST API. Edit there for hymn API work; do not enable Statamic's REST API.
- **Revisions**: off (`STATAMIC_REVISIONS_ENABLED=false`). No draft/publish flow; saves live immediately. On prod, CP saves become content the cron commits to git within the hour.

---

## 10. Batch content imports (local → prod) — occasional exception

Allowed occasionally for ~50+ new hymns at a time. **Additive content-only** — creates new files, never modifies existing ones.

### Why it's safe
Each hymn is a self-contained `.md` file with two unique keys (filename/slug + UUIDv4 `id:`). New files merge cleanly with concurrent CP activity on prod — git only conflicts when two operations touch the *same* file path.

### Safeguards (mandatory)
1. **Generate slug + fresh UUIDv4 per hymn.** Abort (or rename) if either collides with an existing file or `id:`. Use `php artisan tinker` `Str::uuid()` or `uuid -v4`.
2. **Every file must match `resources/blueprints/collections/hymns/hymn.yaml`** — see §6 for field requirements.
3. **Slug and lyric conventions** — see §6. Transliterated Greek (Greeklish) ASCII slugs; verses numbered; chorus in `_..._`. Use `aionios-theos.md` as the reference template.
4. **If including chord PDFs**: upload to `content/assets/greek-chords/` first, then reference in `greek_chords` frontmatter. Never write a chord path without the file present.
5. **Pre-commit uniqueness check**: `rg "^id:" content/collections/hymns/*.md | sort | uniq -d` — must return empty.
6. **Commit as one atomic commit**. Message: `content(batch): add N hymns`.
7. **Push timing**: avoid the top of the hour (cron fires at :00). Push between :05 and :55.
8. **After push lands on prod**: smoke-test — `curl https://ainosbase.gr/api/hymns | jq 'length'` — and confirm it matches `ls content/collections/hymns/*.md | wc -l` locally.
9. **If something is wrong after the batch is live**: fix forward. Never `git push --force` — it breaks the server's auto-rebase path.
10. **Don't run a batch while Tim is actively editing any of the same hymns in the Statamic CP.**

---

## 11. Coding conventions

- **Indent**: 4 spaces (2 for `*.yml`/`*.yaml`), LF endings, UTF-8, final newline. Enforced via `.editorconfig`.
- **PHP**: PSR-12-ish (matches Laravel/Statamic conventions). Run `vendor/bin/pint` before committing.
- **Templates**: Antlers (`.antlers.html`) is the default. Blade is used **only** for `presenter/present.blade.php`. Don't introduce Blade where Antlers will do.
- **Front-end**: Tailwind 3 utilities + SCSS partials under `resources/css/partials/`. Layout loads `{{ vite src="resources/js/site.js|resources/css/site.scss" }}`.
- **Vite inputs**: `resources/css/site.scss`, `resources/js/site.js`, `resources/js/presenter.js` (configured in `vite.config.js`). Adding a new entry requires wiring `{{ vite src=... }}` into the target layout too.
- **`please` vs `php artisan`**: the `please` script at repo root is Statamic's `artisan` wrapper; either works. Prefer `php artisan` for non-Statamic tasks.

---

## 12. Pinned dependencies — bump deliberately, never as a side-effect

- **Statamic** `^6.0`, **Laravel** `^12.0`, **PHP** `^8.2`
- **Tailwind** `^3.4` — **v4 is breaking** (see §13)
- **Vite** `^6`
- Composer `platform.php: 8.2` is deliberate (lowest target). Do not raise it casually.

Any version bump must be a deliberate decision approved by Tim, not a side-effect of a deps refresh.

---

## 13. Tailwind v4 policy

- **Current**: pin at `^3.4`. v4 is **forbidden as a side-effect** of a deps refresh or casual bump.
- **v4 is breaking for this repo** because: ground-up rewrite — config model moves from `tailwind.config.js` to CSS `@theme` blocks, PostCSS plugin replaced by `@tailwindcss/vite`, `@tailwind base/components/utilities` → `@import "tailwindcss"`, engine rewritten in Rust (Oxide) with stricter utility semantics, `@tailwindcss/typography` prose modifier syntax changed. A bump touches `tailwind.config.js`, `postcss.config.js`, every SCSS partial in `resources/css/partials/`, every `@tailwind` import, and prose usage in hymn/presenter views.
- **v4 is allowed only as a deliberate, Tim-approved migration** on a dedicated `feat/tailwind-v4` branch. **Not currently recommended** — v3.4 is fully supported, the site is small so v4's build-speed/DX upside is barely felt, and the cost concentrates in the SCSS partials + `prose-*` views that get touched most. Revisit when: a broader redesign is planned, or v3 enters maintenance-only (years away).
- **Migration path when greenlit**: dedicated `feat/tailwind-v4` branch, run `npx @tailwindcss/upgrade`, audit all SCSS partials + prose usage in hymn/search/presenter views, screenshot-diff before/after, PR with notes, Tim approves, merge → deploy. Revertible via revert PR.

---

## 14. Required checks before declaring a task done

1. **`vendor/bin/pint`** — format PHP. Must pass clean.
2. **`php artisan test`** (or `vendor/bin/phpunit`) — test suite is currently scaffold-only (`ExampleTest`s). Tests must pass; adding tests is by Tim's approval only (see §16). Flag to Tim if a дым smoke test for a new feature is missing — do not add it without approval.
3. **`php artisan route:list`** — after any routing change, diff against the prior list.
4. **Manual smoke**: `php artisan serve` and visually check affected pages (home, hymn list, hymn show, search, presenter builder, presenter present) before committing code changes.
5. **`git status` clean intent** — stage only intended changes; never `git add .` blindly. Server-synced `content/` and `users/` differences can appear unexpectedly after `git pull`.

---

## 15. Things an agent must NOT do without explicit Tim approval

- Touch `content/collections/pages/ymnoi.md` (the mount UUID — see §5) or anything in `users/`.
- Edit `.github/workflows/deploy.yml` or paths adjacent to the `content-sync.sh` cron choreography.
- Enable static caching, REST/GraphQL API, or revisions in `.env` or `config/statamic/*` (see §9).
- Add new Composer or NPM deps, new Statamic addons, new Livewire components, or new Vue fieldtypes.
- Run `composer install`, `php artisan migrate`, `stache:clear`, or `cache:clear` directly against prod — these go through the deploy pipeline (see §7).
- `git push --force`, `git push --force-with-lease`, or rebase `main` (see §7).
- Edit the `vite.config.js` input array without also wiring `{{ vite src=... }}` into the target layout.
- Bump Tailwind to v4 **as a side-effect** (v4 allowed only as a deliberate migration on a `feat/tailwind-v4` branch — see §13).
- Add or expand the automated test suite beyond the existing scaffold `ExampleTest`s (see §16).
- Push code directly to `main` (use a `feat/*` or `fix/*` branch → PR). Direct-to-`main` is reserved for content batches only (see §8).
- **Commit secrets** — see §17.

---

## 16. Test policy

- The test suite is currently scaffold-only (`tests/Unit/ExampleTest.php`, `tests/Feature/ExampleTest.php`).
- AGENTS.md wording is **aspirational**: "add tests where you change behaviour" — but any actual test addition requires explicit Tim approval.
- If you add a feature and a smoke test is missing, **flag it** to Tim; do not add the test autonomously.
- Constant review of the test surface is expected; autonomous expansion is not.

---

## 17. Secrets and security

### Never commit (to git, ever)
- `.env`, `.env.production`, `.env.*.local`
- GitHub Personal Access Tokens (PATs)
- SSH **private** keys (the private half — the public half is fine, see below)
- `STATAMIC_LICENSE_KEY`
- `auth.json`, `scripts/secrets/` (if we ever create it)

`.gitignore` already excludes `.env*`, `auth.json`. If you introduce a new secret path, add it to `.gitignore` immediately.

### Commit-safe (public by nature)
- Public SSH keys (`ssh-ed25519 AAAA...` — the literal in `scripts/server-setup.sh` is a **public** key, not a leak).
- Hostnames, deploy usernames, non-secret config values.

### Production `.env`
- Maintained out-of-band on the server (placed by `scripts/server-setup.sh` at provision time, never committed).
- If you introduce a new production env var, you must also document how to get it onto the server (the deploy action does not copy it).

### Rotation hygiene (flagged follow-up, not yet implemented)
- `scripts/server-setup.sh` currently hardcodes public SSH keys inline. Public keys are safe to commit, but inlining them means rotation requires editing the repo (and the commit history permanently retains old keys). **Flagged for refactor**: read public keys from a runtime file (`scripts/authorized_keys.txt` — committed as public, or gitignored) instead of inline literals.

---

## 18. Local `.env` and DB realities

- MySQL is wired (`DB_CONNECTION=mysql`, db `laravel`, user `root`) but content lives in flat files. Hymns/pages render regardless of MySQL state.
- `php artisan migrate:fresh` will not delete hymns but will wipe `users` created via CP. **Default to `--pretend`** / inspect `database/migrations` before migrating. The repo currently has only the default Statamic/Laravel stub migrations.
- Dev packages (debugbar, laravel-ignition, etc.) are installed locally but absent on prod (deploy runs `composer install --no-dev`). Don't write runtime code that depends on dev packages.

---

## 19. Scaffold that exists but is currently inert

- `tests/Unit/` and `tests/Feature/` only contain `ExampleTest.php`. See §16.
- `resources/js/components/fieldtypes/ExampleFieldtype.vue` is a stub — safe to delete if no addon is being built; reference for Vue fieldtype registration if one is.
- `cp.js` / `cp.css` are commented out in `vite.config.js` — Control Panel customization is opt-in only.

---

## 20. How to ask for clarification

This is the only project doc. If anything here is ambiguous, contradicts the code, or doesn't cover a situation you're facing:
- **Stop.** Don't guess.
- Flag the ambiguity to Tim with the specific file/line and the question.
- Default to the most conservative interpretation until you get an answer.

The deploy pipeline, the auto-sync choreography, the mount UUID, and the Tailwind pin are the four things most likely to be silently broken by a well-intentioned change. Treat them as load-bearing.