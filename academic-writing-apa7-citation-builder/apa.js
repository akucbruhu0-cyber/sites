// APA 7 formatter: journal article + chapter in edited book, Hebrew and English sources.
// Hebrew rules follow the YVC library guide (aparules_heb_7th_ed): ו instead of &, א' initials, ואחרים, עמ'.
(function (root) {
  const HE = /[֐-׿]/;
  const clean = s => String(s ?? '').trim().replace(/\s+/g, ' ');
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const endWith = (s, re, ch = '.') => (!s || re.test(s) ? s : s + ch);
  const last = a => a[a.length - 1];
  const named = list => (list || []).filter(p => clean(p.family) || clean(p.given));

  // The language of the source decides connectors (ו/&, ואחרים/et al., עמ'/pp.).
  function detectLang(d) {
    if (d.lang) return d.lang; // manual override
    const probe = clean(d.title) || clean(d.journal) || clean(d.book) ||
      named(d.authors).map(a => a.family + a.given).join('');
    return !probe || HE.test(probe) ? 'he' : 'en'; // nothing typed yet → Hebrew (the site's audience)
  }

  // The script of each name decides its initials: "J. M." / "J.-P." vs "א'" / "ג"מ".
  function initials(given) {
    if (HE.test(given)) {
      // A geresh inside a name belongs to the letter (ג'ון, ז'קלין); only tokens that are already initials split (א'ב' / א.ב. / ג"מ).
      const l = clean(given).split(/[\s-]+/).flatMap(w =>
        /^([א-ת]['׳.])+$/.test(w) || /^[א-ת]+["״][א-ת]$/.test(w)
          ? w.replace(/['׳."״]/g, '').split('')
          : [w.replace(/^['׳."״]+/, '')[0]]).filter(Boolean);
      if (!l.length) return '';
      return l.length === 1 ? l[0] + "'" : l.slice(0, -1).join('') + '"' + last(l);
    }
    const words = clean(given).replace(/[.'"׳״]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    return words.map(w => w.split('-').filter(Boolean).map(p => p[0].toUpperCase() + '.').join('-')).join(' ');
  }

  // Empty given name = group author (organization), printed in full.
  const surnameFirst = p => (clean(p.given) && clean(p.family) ? `${clean(p.family)}, ${initials(p.given)}` : clean(p.family) || clean(p.given));
  const initialsFirst = p => (clean(p.given) && clean(p.family) ? `${initials(p.given)} ${clean(p.family)}` : clean(p.family) || clean(p.given));
  const heAnd = s => (HE.test(s[0]) ? 'ו' : 'ו-') + s;

  // he: "א, ב וג"  en: "A, B, & C" (authors) or "A & B" (two editors). 21+: first 19, "...", last.
  function joinNames(n, lang, twoNoComma) {
    if (n.length < 2) return n[0] || '';
    if (n.length > 20) return [...n.slice(0, 19), '... ' + last(n)].join(', ');
    if (lang === 'he') return n.slice(0, -1).join(', ') + ' ' + heAnd(last(n));
    if (n.length === 2 && twoNoComma) return `${n[0]} & ${n[1]}`;
    return n.slice(0, -1).join(', ') + ', & ' + last(n);
  }

  const pages = s => clean(s).replace(/^(pp?\.|עמ['׳]?|ע['׳])\s*/i, '').replace(/(\d)\s*[-‐‑‒–—―]\s*(\d)/g, '$1–$2');

  function link(s) {
    s = clean(s).replace(/[.,;]+$/, '');
    const doi = s.match(/10\.\d{4,9}\/\S+/);
    return doi ? 'https://doi.org/' + doi[0] : s;
  }

  // A run is a plain string or {i: text} for italics. Each segment maps to one group of form fields.
  function source(d, lang) {
    const p = pages(d.pages);
    if (d.type === 'chapter') {
      const eds = named(d.editors);
      const role = lang === 'he' ? (eds.length > 1 ? 'עורכים' : d.editorRole || 'עורך') : eds.length > 1 ? 'Eds.' : 'Ed.';
      const who = eds.length ? ` ${joinNames(eds.map(initialsFirst), lang, true)} (${role}),` : '';
      const pp = !p ? '' : lang === 'he' ? ` (עמ' ${p})` : ` (${p.includes('–') ? 'pp.' : 'p.'} ${p})`;
      const pub = clean(d.publisher);
      return [(lang === 'he' ? 'בתוך' : 'In') + who + ' ', { i: clean(d.book) }, pp + '.' + (pub ? ' ' + endWith(pub, /[.]$/) : '')];
    }
    const j = clean(d.journal), v = clean(d.volume), iss = clean(d.issue);
    if (!j) return [];
    return [{ i: j + (v ? ', ' + v : '') }, (iss ? `(${iss})` : '') + (p ? ', ' + p : '') + '.'];
  }

  function format(d) {
    const lang = detectLang(d);
    const authors = named(d.authors);
    const year = clean(d.year) || (lang === 'he' ? 'ללא תאריך' : 'n.d.');
    const title = endWith(clean(d.title), /[.?!]$/);
    const segs = [];
    if (authors.length) {
      // A person ends with initials (J. / א' / ג"מ); only an organization as last author needs a period before the date.
      const names = joinNames(authors.map(surnameFirst), lang);
      const lastIsOrg = !(clean(last(authors).family) && clean(last(authors).given));
      segs.push(['authors', [lastIsOrg ? endWith(names, /[.]$/) : names]], ['date', [`(${year}).`]], ['title', [title]]);
    } else {
      segs.push(['title', [title]], ['date', [`(${year}).`]]);
    }
    segs.push(['source', source(d, lang)], ['link', [link(d.link)]]);

    const segments = segs
      .map(([key, runs]) => ({
        key,
        html: runs.map(r => (typeof r === 'string' ? esc(r) : r.i ? `<i>${esc(r.i)}</i>` : '')).join(''),
        text: runs.map(r => (typeof r === 'string' ? r : r.i)).join(''),
      }))
      .filter(s => s.text.trim());

    const req = d.type === 'chapter'
      ? [['title', 'כותרת הפרק'], ['year', 'שנה'], ['book', 'שם הספר'], ['publisher', 'הוצאה לאור']]
      : [['title', 'כותרת המאמר'], ['year', 'שנה'], ['journal', 'שם כתב העת'], ['volume', 'כרך']];
    const missing = req.filter(([k]) => !clean(d[k])).map(([, label]) => label);
    if (!authors.length) missing.unshift('מחברים');

    return {
      lang,
      segments,
      html: segments.map(s => s.html).join(' '),
      text: segments.map(s => s.text).join(' '),
      missing,
    };
  }

  // In-text: (כהן ולוי, 2001) / כהן ולוי (2001); 3+ → ואחרים / et al.; no author → "title".
  function inText(d) {
    const lang = detectLang(d);
    const he = lang === 'he';
    const fam = named(d.authors).map(p => clean(p.family) || clean(p.given));
    const year = clean(d.year) || (he ? 'ללא תאריך' : 'n.d.');
    const title = clean(d.title).replace(/[.]$/, '');
    if (!fam.length) {
      if (!title) return null;
      return he
        ? { paren: `("${title}", ${year})`, narrative: `"${title}" (${year})` }
        : { paren: `("${title},", ${year})`.replace(',",', ',"'), narrative: `"${title}" (${year})` };
    }
    let p, n;
    if (fam.length > 2) p = n = fam[0] + (he ? ' ואחרים' : ' et al.');
    else if (fam.length === 2) {
      p = he ? `${fam[0]} ${heAnd(fam[1])}` : `${fam[0]} & ${fam[1]}`;
      n = he ? p : `${fam[0]} and ${fam[1]}`;
    } else p = n = fam[0];
    return { paren: `(${p}, ${year})`, narrative: `${n} (${year})` };
  }

  // English article titles must be sentence case. Keeps acronyms/mixed-case words (ADHD, iPhone, COVID-19).
  function sentenceCase(t) {
    return t.replace(/\S+/g, (w, i) => {
      const start = i === 0 || /[:?!.—–]$/.test(t.slice(0, i).trimEnd());
      if (w === 'I' || /[A-Z]{2}|[a-z][A-Z]|\d/.test(w)) return w;
      const lower = w.toLowerCase();
      return start ? lower.replace(/\p{L}/u, c => c.toUpperCase()) : lower;
    });
  }

  function looksTitleCase(t) {
    if (HE.test(t)) return false;
    const words = clean(t).split(' ').slice(1).filter(w => /^[A-Za-z]{4,}/.test(w));
    return words.length >= 2 && words.filter(w => /^[A-Z][a-z]/.test(w)).length / words.length > 0.5;
  }

  const APA = { format, inText, sentenceCase, looksTitleCase, detectLang, initials };
  if (typeof module !== 'undefined') module.exports = APA;
  else root.APA = APA;
})(this);
