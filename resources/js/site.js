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
