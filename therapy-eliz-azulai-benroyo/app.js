// קצב הנשימה: שניות שאיפה ושניות נשיפה. אפשר לשנות כאן בלבד.
const BREATH = { inhale: 4, exhale: 6 };

const $ = id => document.getElementById(id);
const root = document.documentElement;
const calm = matchMedia('(prefers-reduced-motion: reduce)');

function initNav() {
  const set = () => $('nav').classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', set, { passive: true });
  set();
}

// The fixed WhatsApp button steps aside while a full-size one is on screen.
function initStickyCta() {
  const visible = new Set();
  const io = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    $('dock').classList.toggle('on', visible.size === 0);
  });
  document.querySelectorAll('[data-cta] .pill').forEach(el => io.observe(el));
}

// The circle breathes by itself while it is on screen, and can be paused.
function initBreath() {
  const btn = $('breath-btn'), word = $('breath-word'), box = $('breath');
  const orbs = [...document.querySelectorAll('.orb i')];
  let timer = 0, i = 0, onScreen = false, held = false;
  btn.hidden = false;

  const move = (from, to, seconds) => {
    orbs.forEach(o => {
      o.getAnimations().forEach(a => a.cancel());
      if (!calm.matches) o.animate([{ transform: `scale(${from})` }, { transform: `scale(${to})` }],
        { duration: seconds * 1000, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    });
  };
  const step = () => {
    const inhale = i % 2 === 0, seconds = inhale ? BREATH.inhale : BREATH.exhale;
    word.textContent = inhale ? 'שאיפה' : 'נשיפה';
    word.classList.add('on');
    inhale ? move(.72, 1, seconds) : move(1, .72, seconds);
    i++;
    timer = setTimeout(step, seconds * 1000);
  };
  const sync = () => {
    clearTimeout(timer);
    box.classList.toggle('running', onScreen);
    if (onScreen && !held) { i = 0; step(); }
    else { orbs.forEach(o => o.getAnimations().forEach(a => a.cancel())); word.classList.remove('on'); }
    btn.textContent = held ? 'להמשיך' : 'להשהות';
  };
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; sync(); }, { threshold: .4 }).observe(box);
  btn.addEventListener('click', () => { held = !held; sync(); });
  document.addEventListener('motionpause', e => { held = e.detail; sync(); });
  // with reduced motion the circle holds still and only the words alternate
  calm.addEventListener('change', sync);
}

// Circles grow with the scroll up to a final size: --p runs 0..1 on each [data-grow].
// "scroll" = by distance from the top (the hero), otherwise by where the element sits in the viewport.
function initGrow() {
  const els = [...document.querySelectorAll('[data-grow]')];
  let queued = false;
  const update = () => {
    queued = false;
    const vh = innerHeight;
    for (const e of els) {
      let p = 1;
      if (!calm.matches) {
        p = e.dataset.grow === 'scroll' ? scrollY / (vh * .5)
          : (vh - e.getBoundingClientRect().top) / (.5 * vh + e.offsetHeight / 2);
      }
      p = Math.min(1, Math.max(0, p));
      e.style.setProperty('--p', p.toFixed(3));
      e.classList.toggle('grown', p >= .75);
    }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  calm.addEventListener('change', update);
  update();
}

function initReveal() {
  const els = [...document.querySelectorAll('[data-r]')];
  const show = e => e.classList.add('in');
  if (calm.matches || !('IntersectionObserver' in window)) return els.forEach(show);
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
  }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
}

// WCAG 2.2.2: anything that moves by itself for more than 5 seconds can be paused.
function initPause() {
  const b = $('pause');
  b.hidden = false;
  b.addEventListener('click', () => {
    const on = root.classList.toggle('paused');
    b.setAttribute('aria-pressed', on);
    b.textContent = on ? 'הפעלת תנועה' : 'עצירת תנועה';
    document.dispatchEvent(new CustomEvent('motionpause', { detail: on }));
  });
}

initNav(); initStickyCta(); initBreath(); initGrow(); initReveal(); initPause();
