const MAX_LINES = 4;

function decodeSetlist(hash) {
    if (!hash || hash === '#') return { hymns: [], lang: 'greek' };
    try {
        return JSON.parse(atob(hash.replace(/^#/, '')));
    } catch {
        return { hymns: [], lang: 'greek' };
    }
}

async function fetchHymns() {
    const res = await fetch('/api/hymns');
    return res.json();
}

function splitLyrics(text) {
    if (!text) return [];

    const paragraphs = text.trim().replace(/\r\n/g, '\n').split(/\n\n+/);
    const blocks = [];

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        const isChorus = trimmed.startsWith('_');
        // Strip leading/trailing underscore markers (chorus delimiters)
        const clean = trimmed.replace(/^_+/, '').replace(/_+$/, '').trim();
        const lines  = clean.split('\n').filter(l => l.trim() !== '');

        if (lines.length <= MAX_LINES) {
            blocks.push({ lines, isChorus });
        } else {
            for (let i = 0; i < lines.length; i += MAX_LINES) {
                blocks.push({ lines: lines.slice(i, i + MAX_LINES), isChorus });
            }
        }
    }

    return blocks;
}

function cleanLine(line) {
    // Remove verse number prefixes like "1. " or "2. "
    return line.replace(/^\d+\.\s*/, '').trim();
}

function buildSlides(setlist, hymnsData, language) {
    const slides = [{ type: 'blank' }];

    for (const { slug } of setlist) {
        const hymn = hymnsData[slug];
        if (!hymn) continue;

        slides.push({ type: 'title', title: hymn.title });

        const primaryText   = language === 'english' ? hymn.english_lyrics : hymn.greek_lyrics;
        const secondaryText = language === 'both'    ? hymn.english_lyrics : null;

        const primaryBlocks   = splitLyrics(primaryText);
        const secondaryBlocks = secondaryText ? splitLyrics(secondaryText) : null;

        primaryBlocks.forEach((block, i) => {
            slides.push({
                type:      'lyrics',
                songTitle: hymn.title,
                lines:     block.lines,
                isChorus:  block.isChorus,
                secondary: secondaryBlocks?.[i] ?? null,
            });
        });
    }

    slides.push({ type: 'blank' });
    return slides;
}

function renderSlide(slide, container) {
    container.className = 'slide slide--' + slide.type;
    container.innerHTML = '';

    if (slide.type === 'blank') return;

    if (slide.type === 'title') {
        const h1 = document.createElement('h1');
        h1.className  = 'slide-title';
        h1.textContent = slide.title;
        container.appendChild(h1);
        return;
    }

    // lyrics
    const label = document.createElement('div');
    label.className  = 'slide-song-label';
    label.textContent = slide.songTitle;
    container.appendChild(label);

    const primary = document.createElement('div');
    primary.className = 'slide-lyrics' + (slide.isChorus ? ' slide-lyrics--chorus' : '');
    slide.lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = cleanLine(line);
        primary.appendChild(p);
    });
    container.appendChild(primary);

    if (slide.secondary) {
        const sec = document.createElement('div');
        sec.className = 'slide-secondary';
        slide.secondary.lines.forEach(line => {
            const p = document.createElement('p');
            p.textContent = cleanLine(line);
            sec.appendChild(p);
        });
        container.appendChild(sec);
    }
}

// ── State ─────────────────────────────────────────────────────────────────────

let slides = [];
let idx    = 0;

function goTo(i) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    renderSlide(slides[idx], document.getElementById('slide'));
    const prog = document.getElementById('progress');
    if (prog) prog.textContent = `${idx + 1} / ${slides.length}`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const slideEl = document.getElementById('slide');
    if (!slideEl) return; // not on presenter page

    const { hymns: setlist, lang } = decodeSetlist(location.hash);

    if (!setlist.length) {
        slideEl.className = 'slide slide--blank slide--empty';
        slideEl.innerHTML = '<p class="slide-empty-msg">Δεν βρέθηκε λίστα. <a href="/presenter">← Επιστροφή</a></p>';
        return;
    }

    const hymnsData = await fetchHymns();
    slides = buildSlides(setlist, hymnsData, lang);
    goTo(0);

    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(idx + 1); }
        else if (e.key === 'ArrowLeft')               { goTo(idx - 1); }
        else if (e.key === 'f' || e.key === 'F')      { document.documentElement.requestFullscreen?.(); }
        else if (e.key === 'Escape' && document.fullscreenElement) { document.exitFullscreen(); }
    });

    slideEl.addEventListener('click', () => goTo(idx + 1));

    document.getElementById('btn-prev')?.addEventListener('click', e => { e.stopPropagation(); goTo(idx - 1); });
    document.getElementById('btn-next')?.addEventListener('click', e => { e.stopPropagation(); goTo(idx + 1); });
    document.getElementById('btn-fullscreen')?.addEventListener('click', e => {
        e.stopPropagation();
        document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen?.();
    });
});
