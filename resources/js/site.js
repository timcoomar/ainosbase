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
