// Monotonic Greek uppercase without accents on non-initial letters.
//
// Rule: uppercase every letter; keep the accent on the first letter of each
// word (so Ύμνων → ΎΜΝΩΝ); strip it from all subsequent letters
// (so Επιλογή → ΕΠΙΛΟΓΗ, not ΕΠΙΛΟΓΉ).

const GREEK_STRIP_UPPER = {
    'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
};

function deAccentUppercase(text) {
    return text.replace(/\S+/gu, word =>
        [...word].map((char, i) => {
            const up = char.toUpperCase();
            return i === 0 ? up : (GREEK_STRIP_UPPER[up] ?? up);
        }).join('')
    );
}

function applyGreekUppercase() {
    document.querySelectorAll('.greek-uppercase').forEach(el => {
        el.textContent = deAccentUppercase(el.textContent);
    });
}

document.addEventListener('DOMContentLoaded', applyGreekUppercase);

// ── Setlist persistence (localStorage-backed) ───────────────────────────────
//
// The presenter builder page exposes a launch URL containing a base64 payload
// that encodes {hymns: [{slug, title}], lang}. We reuse that exact payload
// format for saved setlists in localStorage under the key `ainos_setlists`.
// A "Save" button reads the current launch URL's hash and stores it under
// a user-named entry. "Load" dispatches a Livewire event with the payload;
// "Open" launches the presenter directly; "Delete" removes the entry.

(function () {
    var STORAGE_KEY = 'ainos_setlists';
    var MAX_SAVED = 20;

    function getStore() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
        } catch (e) { return {}; }
    }
    function writeStore(store) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) {}
    }

    function currentPayloadFromDoc() {
        var link = document.querySelector('.btn-launch');
        if (!link) return null;
        var hash = (link.getAttribute('href') || '').split('#')[1] || '';
        return hash || null;
    }

    function fmtDate(iso) {
        try {
            var d = new Date(iso);
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        } catch (e) { return ''; }
    }

    function renderSavedList() {
        var section = document.getElementById('saved-setlists');
        if (!section) return;
        var list = document.getElementById('saved-list');
        var empty = section.querySelector('.saved-empty');
        var tmpl = document.getElementById('saved-row-tmpl');
        var store = getStore();
        var names = Object.keys(store).sort(function (a, b) {
            return (store[b].saved_at || '').localeCompare(store[a].saved_at || '');
        });

        list.innerHTML = '';
        if (!names.length) {
            section.hidden = false;
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;
        section.hidden = false;

        names.forEach(function (name) {
            var entry = store[name];
            var row = tmpl.content.firstElementChild.cloneNode(true);
            row.dataset.name = name;
            row.querySelector('.saved-name').textContent = name;
            row.querySelector('.saved-meta').textContent = entry.count + ' ύμνοι · ' + fmtDate(entry.saved_at);
            row.querySelector('.btn-saved-open').href = '/presenter/present#' + entry.payload;
            row.querySelector('.btn-saved-load').addEventListener('click', function () {
                if (window.Livewire && typeof window.Livewire.dispatch === 'function') {
                    window.Livewire.dispatch('load-setlist', { payload: entry.payload });
                }
                row.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            row.querySelector('.btn-saved-delete').addEventListener('click', function () {
                if (!confirm('Διαγραφή "' + name + '";')) return;
                var s = getStore();
                delete s[name];
                writeStore(s);
                renderSavedList();
            });
            list.appendChild(row);
        });
    }

    function saveCurrentSetlist() {
        var payload = currentPayloadFromDoc();
        if (!payload) return;
        var name = prompt('Όνομα λίστας:');
        if (!name) return;
        name = name.trim();
        if (!name) return;
        var store = getStore();
        if (store[name] && !confirm('Υπάρχει ήδη λίστα "' + name + '". Αντικατάσταση;')) return;
        var count = 0;
        try {
            var data = JSON.parse(atob(payload));
            count = Array.isArray(data.hymns) ? data.hymns.length : 0;
        } catch (e) {}
        store[name] = { payload: payload, saved_at: new Date().toISOString(), count: count };
        writeStore(store);
        // Cap at MAX_SAVED: drop oldest beyond cap
        var names = Object.keys(store).sort(function (a, b) {
            return (store[a].saved_at || '').localeCompare(store[b].saved_at || '');
        });
        while (names.length > MAX_SAVED) {
            delete store[names.shift()];
            writeStore(store);
        }
        renderSavedList();
    }

    // Wire the Save button via event delegation on document — the button is
    // conditionally rendered inside a Livewire-managed region (it only
    // exists when setlist_indexed is non-empty), so a direct addEventListener
    // would be lost every time Livewire re-renders the component (e.g. when a
    // hymn is added or reordered). Delegation survives DOM replacement.
    function onReady(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    onReady(renderSavedList);

    document.addEventListener('click', function (e) {
        var target = e.target.closest('#btn-save-setlist');
        if (target) {
            e.preventDefault();
            saveCurrentSetlist();
        }
    });

    // Re-render the saved list after Livewire navigations/refreshes that might
    // swap the builder markup (wire:ignore keeps the section, but ensure the
    // rendered rows stay in sync after livewire:load).
    document.addEventListener('livewire:navigated', renderSavedList);
    document.addEventListener('livewire:load', renderSavedList);
})();

// ── Lyrics view toggle + extended copy-on-clipboard (hymn show page) ────────
//
// Reads the initial view from html[data-lyrics-view] (set by the early inline
// script in layout.antlers.html from localStorage.ainos_lyrics_view). Clicking
// a per-visit toggle button (GR / EN / GR+EN) flips html[data-lyrics-view] and
// persists the chosen view as the new default. The copy button copies whichever
// lyrics are currently visible (Greek, English, or both).

(function () {
    var VIEWS = ['greek', 'english', 'both'];
    var STORAGE_KEY = 'ainos_lyrics_view';
    var root = document.documentElement;

    function currentView() {
        var v = root.getAttribute('data-lyrics-view');
        return VIEWS.indexOf(v) >= 0 ? v : 'greek';
    }

    function setView(view) {
        if (VIEWS.indexOf(view) < 0) view = 'greek';
        root.setAttribute('data-lyrics-view', view);
        try { localStorage.setItem(STORAGE_KEY, view); } catch (e) {}
        document.querySelectorAll('.lyrics-toggle__btn').forEach(function (btn) {
            btn.setAttribute('aria-pressed', btn.dataset.view === view ? 'true' : 'false');
        });
    }

    function visibleLyricsHTML() {
        var view = currentView();
        var parts = [];
        var greek = document.querySelector('#greekLyrics');
        var english = document.querySelector('#englishLyrics');
        if (view !== 'english' && greek)  parts.push(greek.innerHTML);
        if (view !== 'greek'  && english) parts.push(english.innerHTML);
        return parts.join('<br><br>');
    }

    function initLyricsToggle() {
        var toggle = document.querySelector('.lyrics-toggle');
        if (!toggle) return;

        var view = currentView();
        toggle.querySelectorAll('.lyrics-toggle__btn').forEach(function (btn) {
            btn.setAttribute('aria-pressed', btn.dataset.view === view ? 'true' : 'false');
            btn.addEventListener('click', function () {
                setView(btn.dataset.view);
            });
        });
    }

    // ── Copy lyrics button (sits in the same .hymn-title-actions row) ──────
    // Writes both text/html (preserves <p>+<em> for rich paste targets) and
    // text/plain (for plain-text editors); falls back to writeText() if the
    // ClipboardItem API rejects (older Firefox, insecure context). Shows a
    // transient "Αντιγράφηκαν στίχοι" / "Αποτυχία" feedback chip — no alert().

    function paragraphText(container) {
        if (!container) return '';
        var ps = container.querySelectorAll('p');
        if (!ps.length) return container.textContent.trim();
        return Array.prototype.map.call(ps, function (p) {
            return p.textContent.replace(/\s+\n/g, ' ').replace(/\n/g, ' ').trim();
        }).join('\n\n');
    }

    function visibleLyricsContent() {
        var view = currentView();
        var greek = document.querySelector('#greekLyrics');
        var english = document.querySelector('#englishLyrics');
        var blocksHTML = [];
        var blocksText = [];

        if (view !== 'english' && greek) {
            blocksHTML.push(greek.innerHTML);
            blocksText.push(paragraphText(greek));
        }
        if (view !== 'greek' && english) {
            blocksHTML.push(english.innerHTML);
            blocksText.push(paragraphText(english));
        }
        return {
            html: blocksHTML.join('<br><br>'),
            text: blocksText.join('\n\n')
        };
    }

    function showCopyFeedback(message) {
        var feedback = document.getElementById('copy-feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.add('is-visible');
        clearTimeout(showCopyFeedback._timer);
        showCopyFeedback._timer = setTimeout(function () {
            feedback.classList.remove('is-visible');
            feedback.textContent = '';
        }, 2000);
    }

    async function copyLyricsToClipboard() {
        var content = visibleLyricsContent();
        if (!content.text && !content.html) {
            showCopyFeedback('Κενό');
            return;
        }

        // Preferred path: ClipboardItem with both text/html and text/plain,
        // so the paste destination picks whichever MIME it supports.
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.write === 'function') {
            try {
                var htmlBlob = new Blob([content.html], {type: 'text/html'});
                var textBlob = new Blob([content.text], {type: 'text/plain'});
                var item = new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                });
                await navigator.clipboard.write([item]);
                showCopyFeedback('Αντιγράφηκαν στίχοι');
                return;
            } catch (err) {
                // Fall through to plain-text-only path below.
                console.warn('ClipboardItem write failed, falling back to writeText:', err);
            }
        }

        // Fallback: plain text only.
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(content.text);
                showCopyFeedback('Αντιγράφηκαν στίχοι');
                return;
            } catch (err) {
                console.error('writeText failed:', err);
            }
        }

        showCopyFeedback('Αποτυχία');
    }

    function initCopyLyricsButton() {
        var btn = document.getElementById('copy-lyrics-btn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            // Don't await — let feedback fire after the promise resolves.
            copyLyricsToClipboard();
        });
    }

    document.addEventListener('DOMContentLoaded', initLyricsToggle);
    document.addEventListener('DOMContentLoaded', initCopyLyricsButton);
})();

// ── Favourites (localStorage-backed) ────────────────────────────────────────
//
// Stores an array of hymn slugs in localStorage under `ainos_favourites`.
// A star toggle on the hymn show page + each row of the hymns list page
// flips membership. The list page also has an All / Αγαπημένα filter that
// hides non-favourite rows when Αγαπημένα is active. All listeners are
// attached via event delegation on document so they survive any future
// DOM swaps and cover every toggle without per-button wiring.

(function () {
    var STORAGE_KEY = 'ainos_favourites';

    function getFavs() {
        try {
            var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (e) { return []; }
    }
    function writeFavs(favs) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(favs)); } catch (e) {}
    }
    function isFav(slug) {
        return getFavs().indexOf(slug) >= 0;
    }
    function toggleFav(slug) {
        var favs = getFavs();
        var i = favs.indexOf(slug);
        if (i >= 0) { favs.splice(i, 1); }
        else { favs.push(slug); }
        writeFavs(favs);
        return i < 0; // true if now favourited
    }

    function paintStar(button, favourited) {
        if (!button) return;
        button.setAttribute('aria-pressed', favourited ? 'true' : 'false');
        button.setAttribute('aria-label',  favourited ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα');
        button.setAttribute('title',      favourited ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα');
        button.classList.toggle('is-fav', favourited);
        var star = button.querySelector('.fav-toggle__star');
        if (star) {
            star.setAttribute('fill', favourited ? 'currentColor' : 'none');
        }
    }

    function paintAllStars() {
        document.querySelectorAll('[data-fav-slug]').forEach(function (btn) {
            paintStar(btn, isFav(btn.dataset.favSlug));
        });
    }

    function applyListFilter(filter) {
        var main = document.querySelector('[data-favourites-scope]');
        if (!main) return;
        var buttons = main.querySelectorAll('.hymns-filter__btn');
        buttons.forEach(function (btn) {
            var active = btn.dataset.filter === filter;
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.classList.toggle('is-active', active);
        });

        var posts = document.getElementById('hymns-posts');
        if (!posts) return;
        var showFavOnly = (filter === 'favourites');
        // Persist the active filter so reload / navigation keeps the choice.
        try { localStorage.setItem('ainos_favourites_filter', showFavOnly ? 'favourites' : 'all'); } catch (e) {}
        posts.querySelectorAll('.post').forEach(function (article) {
            var slug = article.dataset.hymnSlug;
            var show = !showFavOnly || isFav(slug);
            article.style.display = show ? '' : 'none';
        });
        // Surface a friendly empty-state line when filter switches on but
        // nothing is starred yet.
        var emptyNotice = document.getElementById('hymns-filter-empty');
        if (showFavOnly && !posts.querySelector('.post:not([style*="display: none"])')) {
            if (!emptyNotice) {
                emptyNotice = document.createElement('p');
                emptyNotice.id = 'hymns-filter-empty';
                emptyNotice.className = 'hymns-filter-empty';
                emptyNotice.textContent = 'Δεν έχετε προσθέσει αγαπημένα ακόμη. Πατήστε το ★ δίπλα σε έναν ύμνο για να τον προσθέσετε.';
                posts.parentNode.insertBefore(emptyNotice, posts.nextSibling);
            }
            emptyNotice.style.display = '';
        } else if (emptyNotice) {
            emptyNotice.style.display = 'none';
        }
    }

    function onReady(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    onReady(function () {
        paintAllStars();

        // Initialise the list filter to the last-used preference (default 'all')
        var savedFilter = null;
        try { savedFilter = localStorage.getItem('ainos_favourites_filter'); } catch (e) {}
        applyListFilter(savedFilter === 'favourites' ? 'favourites' : 'all');
    });

    // Single delegated click handler covers both the star toggles and the
    // list filter buttons (distinguished by data attribute).
    document.addEventListener('click', function (e) {
        var starBtn = e.target.closest('[data-fav-slug]');
        if (starBtn) {
            e.preventDefault();
            var slug = starBtn.dataset.favSlug;
            var nowFav = toggleFav(slug);
            paintStar(starBtn, nowFav);
            // Paint any other star pointing at the same slug (e.g. list + show
            // happen to share; also handles Livewire re-renders post-event).
            document.querySelectorAll('[data-fav-slug="' + slug + '"]').forEach(function (btn) {
                if (btn !== starBtn) paintStar(btn, nowFav);
            });
            // Re-apply the list filter in case the user just un-favourited
            // the row they were looking at under the Αγαπημένα filter.
            var scope = document.querySelector('[data-favourites-scope]');
            if (scope) {
                var active = scope.querySelector('.hymns-filter__btn[aria-pressed="true"]');
                applyListFilter(active ? active.dataset.filter : 'all');
            }
            return;
        }

        var filterBtn = e.target.closest('.hymns-filter__btn');
        if (filterBtn) {
            e.preventDefault();
            applyListFilter(filterBtn.dataset.filter);
        }
    });
})();
