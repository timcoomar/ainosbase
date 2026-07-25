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

        var copyBtn = document.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', async function () {
                var content = visibleLyricsHTML();
                if (!content) return;
                try {
                    var blob = new Blob([content], {type: 'text/html'});
                    var item = new ClipboardItem({'text/html': blob});
                    await navigator.clipboard.write([item]);
                } catch (err) {
                    console.error('Failed to copy: ', err);
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', initLyricsToggle);
})();
