'use strict';

const VERSION = '1.0';
const STORE_KEY = 'wt-data-v1';
const DAY = 86400000;
const GROUPS = ['Brust', 'Rücken', 'Beine', 'Schultern', 'Arme', 'Core', 'Sonstige'];

/* ================= Daten ================= */

const DEFAULT_SETTINGS = {
  proteinGoal: 150, kcalGoal: 2500, weightGoal: null,
  restSec: 120, increment: 2.5, lastBackup: null, hideInstall: false,
};

const DEFAULT_EXERCISES = [
  ['Bankdrücken', 'Brust', 5, 8],
  ['Schrägbankdrücken (KH)', 'Brust', 8, 12],
  ['Butterfly', 'Brust', 10, 15],
  ['Dips', 'Brust', 6, 12],
  ['Klimmzüge', 'Rücken', 5, 10],
  ['Latzug', 'Rücken', 8, 12],
  ['Langhantelrudern', 'Rücken', 6, 10],
  ['Kabelrudern', 'Rücken', 8, 12],
  ['Kreuzheben', 'Rücken', 3, 6],
  ['Kniebeuge', 'Beine', 5, 8],
  ['Beinpresse', 'Beine', 8, 12],
  ['Rumänisches Kreuzheben', 'Beine', 6, 10],
  ['Beinstrecker', 'Beine', 10, 15],
  ['Beinbeuger', 'Beine', 10, 15],
  ['Hip Thrust', 'Beine', 8, 12],
  ['Wadenheben', 'Beine', 10, 15],
  ['Schulterdrücken', 'Schultern', 6, 10],
  ['Seitheben', 'Schultern', 12, 20],
  ['Face Pulls', 'Schultern', 12, 20],
  ['Bizepscurls', 'Arme', 8, 12],
  ['Hammercurls', 'Arme', 8, 12],
  ['Trizepsdrücken am Kabel', 'Arme', 10, 15],
  ['French Press', 'Arme', 8, 12],
  ['Crunches am Kabel', 'Core', 10, 15],
  ['Beinheben hängend', 'Core', 8, 15],
];

const DEFAULT_TEMPLATES = [
  ['Push', ['Bankdrücken', 'Schrägbankdrücken (KH)', 'Schulterdrücken', 'Seitheben', 'Trizepsdrücken am Kabel']],
  ['Pull', ['Klimmzüge', 'Langhantelrudern', 'Latzug', 'Face Pulls', 'Bizepscurls']],
  ['Beine', ['Kniebeuge', 'Rumänisches Kreuzheben', 'Beinpresse', 'Beinbeuger', 'Wadenheben']],
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function defaultData() {
  const exercises = DEFAULT_EXERCISES.map(([name, group, repMin, repMax]) => ({ id: uid(), name, group, repMin, repMax }));
  const idOf = name => exercises.find(e => e.name === name).id;
  return {
    version: 1,
    exercises,
    templates: DEFAULT_TEMPLATES.map(([name, list]) => ({ id: uid(), name, exerciseIds: list.map(idOf) })),
    workouts: [],
    days: {},
    settings: { ...DEFAULT_SETTINGS },
    activeId: null,
  };
}

let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { db = null; }
  if (!db || !Array.isArray(db.workouts)) { db = defaultData(); save(); }
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings };
  db.days ||= {};
  db.templates ||= [];
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch { toast('Speichern fehlgeschlagen – Speicher voll?'); }
}

/* ================= Helfer ================= */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => {
  if (v == null) return null;
  const s = String(v).replace(',', '.').trim();
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n, d = 1) => n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: d });
const fmtIn = n => n == null ? '' : String(n).replace('.', ',');
const pad = n => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const fmtDay = ts => { const d = new Date(ts); return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
const fmtShort = ts => { const d = new Date(ts); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
const fmtDur = ms => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
};
const clock = ms => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
};
const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const relDay = ts => {
  const n = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
  return n === 0 ? 'heute' : n === 1 ? 'gestern' : `vor ${n} Tagen`;
};
const lastDays = n => Array.from({ length: n }, (_, i) => dateKey(new Date(Date.now() - i * DAY)));
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/* ================= Trainingslogik ================= */

const exById = id => db.exercises.find(e => e.id === id) || { id, name: '(gelöschte Übung)', group: 'Sonstige', repMin: 8, repMax: 12 };
const groupOf = ex => GROUPS.includes(ex.group) ? ex.group : 'Sonstige';
const doneSets = entry => entry.sets.filter(s => s.done && s.r > 0);
// geschätztes Maximalgewicht für 1 Wiederholung (Epley-Formel)
const e1rm = (w, r) => !w || !r ? 0 : r === 1 ? w : w * (1 + r / 30);
const active = () => db.activeId ? db.workouts.find(w => w.id === db.activeId) : null;
const cur = () => db.workouts.find(w => w.id === (ui.editId || db.activeId));
const finished = () => db.workouts.filter(w => w.end).sort((a, b) => b.start - a.start);
const foodTotals = d => ({ p: sum(d?.food || [], f => f.p), k: sum(d?.food || [], f => f.k) });

function lastEntryFor(exId, beforeTs, excludeId) {
  for (const w of finished()) {
    if (w.id === excludeId || w.start >= beforeTs) continue;
    const en = w.entries.find(e => e.exerciseId === exId && doneSets(e).length);
    if (en) return en;
  }
  return null;
}

// alle Einheiten einer Übung, älteste zuerst
function sessionsFor(exId, excludeId) {
  const out = [];
  for (const w of finished()) {
    if (w.id === excludeId) continue;
    const sets = w.entries.filter(e => e.exerciseId === exId).flatMap(doneSets);
    if (!sets.length) continue;
    out.push({
      ts: w.start,
      sets,
      best: Math.max(...sets.map(s => e1rm(s.w, s.r))),
      topW: Math.max(...sets.map(s => s.w || 0)),
      maxR: Math.max(...sets.map(s => s.r)),
    });
  }
  return out.reverse();
}

// Plateau: in den letzten 3 Einheiten kein neuer Bestwert
function stuckIn(sessions) {
  if (sessions.length < 4) return false;
  const before = Math.max(...sessions.slice(0, -3).map(x => x.best));
  const recent = Math.max(...sessions.slice(-3).map(x => x.best));
  return before > 0 && recent <= before;
}

// Doppelte Progression: erst Wdh bis zum oberen Ende steigern, dann Gewicht
function hintFor(ex, prev) {
  if (!prev) return `Neu: wähle ein Gewicht, mit dem du ${ex.repMin}–${ex.repMax} saubere Wdh schaffst.`;
  const sets = doneSets(prev);
  const top = Math.max(...sets.map(s => s.w || 0));
  const topSets = sets.filter(s => (s.w || 0) === top);
  if (topSets.every(s => s.r >= ex.repMax)) {
    const inc = db.settings.increment || 2.5;
    return top > 0
      ? `<b class="up">↑ Steigern auf ${fmt(top + inc, 2)} kg</b>, letztes Mal alle Sätze ≥ ${ex.repMax} Wdh.`
      : `<b class="up">↑ Zusatzgewicht nehmen</b>, letztes Mal alle Sätze ≥ ${ex.repMax} Wdh.`;
  }
  return `Ziel: ${top > 0 ? fmt(top, 2) + ' kg, ' : ''}mehr als ${topSets.map(s => s.r).join('/')} Wdh (bis ${ex.repMax}).`;
}

function newEntry(exId, w) {
  const prev = lastEntryFor(exId, w.start, w.id);
  const n = prev ? doneSets(prev).length : 3;
  return { exerciseId: exId, sets: Array.from({ length: n }, () => ({ w: null, r: null, done: false })) };
}

function startWorkout(tplId) {
  const tpl = db.templates.find(t => t.id === tplId);
  const w = { id: uid(), name: tpl ? tpl.name : 'Training', tplId: tpl?.id || null, start: Date.now(), end: null, note: '', entries: [] };
  if (tpl) w.entries = tpl.exerciseIds.filter(id => db.exercises.some(e => e.id === id)).map(id => newEntry(id, w));
  db.workouts.push(w);
  db.activeId = w.id;
  ui.editId = null;
  save();
  render();
  scrollTo(0, 0);
}

function prevSetsFor(w, en) {
  const prev = lastEntryFor(en.exerciseId, w.start, w.id);
  return prev ? doneSets(prev) : [];
}

function checkPR(w, en, set) {
  const v = e1rm(set.w, set.r);
  if (!v) return;
  const hist = sessionsFor(en.exerciseId, w.id).filter(x => x.ts < w.start);
  if (!hist.length) return;
  const others = w.entries.filter(x => x.exerciseId === en.exerciseId).flatMap(doneSets).filter(x => x !== set);
  const best = Math.max(...hist.map(h => h.best), ...others.map(x => e1rm(x.w, x.r)));
  if (v > best) toast(`🏆 Neuer Rekord: ${fmt(set.w, 2)} kg × ${set.r} (≈ ${fmt(v, 0)} kg 1RM)`);
}

/* ================= Pausentimer ================= */

let rest = null;
let audio = null;

function startRest(sec = db.settings.restSec) {
  if (!sec) return;
  rest = { end: Date.now() + sec * 1000, total: sec * 1000 };
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch { audio = null; }
  tick();
}

function beep() {
  if (!audio) return;
  try {
    const t0 = audio.currentTime;
    [0, 0.25, 0.5].forEach(t => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + t);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(t0 + t);
      o.stop(t0 + t + 0.2);
    });
  } catch { /* egal */ }
}

function tick() {
  if (rest) {
    const left = rest.end - Date.now();
    if (left <= 0) {
      rest = null;
      beep();
      navigator.vibrate?.(300);
      toast('Pause vorbei – nächster Satz!');
    } else {
      $('#rest').hidden = false;
      $('#rest-time').textContent = clock(left + 999);
      $('#rest-fill').style.width = (100 * left / rest.total) + '%';
    }
  }
  if (!rest) $('#rest').hidden = true;
  const t = $('#wk-timer'), a = active();
  if (t && a) t.textContent = clock(Date.now() - a.start);
}
setInterval(tick, 500);

/* ================= UI-Zustand ================= */

const ui = { tab: 'train', editId: null, day: dateKey(), dayFollow: true, progEx: null, sub: '', pick: null, histLimit: 15, persisted: null };

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = true;
  void t.offsetWidth; // Animation neu starten
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').hidden = false;
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet-body').innerHTML = '';
  ui.pick = null;
}

function render() {
  const view = { train: viewTrain, day: viewDay, progress: viewProgress, more: viewMore }[ui.tab] || viewTrain;
  $('#main').innerHTML = view();
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  $('.tabs [data-tab="train"]').classList.toggle('live', !!active());
  tick();
}

/* ================= Ansicht: Training ================= */

function viewTrain() {
  if (ui.editId) {
    const w = db.workouts.find(x => x.id === ui.editId);
    if (w) return workoutView(w, false);
    ui.editId = null;
  }
  const a = active();
  return a ? workoutView(a, true) : trainHome();
}

function banners() {
  let html = '';
  if (!isStandalone() && !db.settings.hideInstall) {
    html += `<div class="banner"><p><b>Tipp:</b> In Safari auf <b>Teilen → Zum Home-Bildschirm</b> tippen. Dann läuft die App im Vollbild, offline, und deine Daten bleiben sicher gespeichert.</p><button class="icon" data-act="dismissInstall" aria-label="Ausblenden">✕</button></div>`;
  }
  const lb = db.settings.lastBackup;
  if (finished().length >= 3 && (!lb || Date.now() - lb > 14 * DAY)) {
    html += `<div class="banner warn"><p>Letztes Backup: <b>${lb ? relDay(lb) : 'noch nie'}</b>. Deine Daten liegen nur auf diesem Handy.</p><button class="primary" data-act="export">Backup</button></div>`;
  }
  return html;
}

function trainHome() {
  const list = finished();
  const today = db.days[dateKey()];
  const tot = foodTotals(today);
  const s = db.settings;
  const lastFor = tpl => {
    const w = list.find(x => x.tplId === tpl.id);
    return w ? relDay(w.start) : 'noch nie';
  };
  return `
    <h1>Training</h1>
    ${banners()}
    <button class="card today" data-act="tab" data-tab="day">
      <div class="stat"><span>Gewicht heute</span><b>${today?.weight ? fmt(today.weight) + ' kg' : '–'}</b></div>
      <div class="stat"><span>Protein</span><b>${fmt(tot.p, 0)}${s.proteinGoal ? ' / ' + s.proteinGoal : ''} g</b></div>
      <div class="stat"><span>Kalorien</span><b>${fmt(tot.k, 0)}${s.kcalGoal ? ' / ' + s.kcalGoal : ''}</b></div>
    </button>
    <section class="card">
      <h2>Training starten</h2>
      <div class="tpl-grid">
        ${db.templates.map(t => `
          <button class="tpl" data-act="start" data-tpl="${t.id}">
            <b>${esc(t.name)}</b><span>${t.exerciseIds.length} Übungen · ${lastFor(t)}</span>
          </button>`).join('')}
        <button class="tpl free" data-act="start" data-tpl=""><b>Freies Training</b><span>Übungen selbst wählen</span></button>
      </div>
    </section>
    <h2 class="sec">Verlauf</h2>
    ${list.length
      ? list.slice(0, ui.histLimit).map(historyItem).join('') +
        (list.length > ui.histLimit ? '<button class="ghost wide" data-act="moreHist">Mehr anzeigen</button>' : '')
      : '<p class="empty">Noch keine Trainings. Starte dein erstes oben.</p>'}`;
}

function historyItem(w) {
  const sets = w.entries.flatMap(doneSets);
  const vol = sum(sets, s => (s.w || 0) * s.r);
  return `
    <button class="card hist" data-act="openWorkout" data-id="${w.id}">
      <div class="row"><b>${esc(w.name)}</b><span class="muted small">${fmtDay(w.start)} · ${relDay(w.start)}</span></div>
      <div class="muted small">${sets.length} Sätze · ${fmt(vol, 0)} kg Volumen · ${fmtDur(w.end - w.start)}</div>
      <div class="names">${w.entries.map(e => esc(exById(e.exerciseId).name)).join(', ')}</div>
    </button>`;
}

function workoutView(w, isActive) {
  const head = isActive
    ? `<div class="wk-head sticky">
         <div><h1>${esc(w.name)}</h1><div class="muted small">läuft seit <span id="wk-timer">${clock(Date.now() - w.start)}</span></div></div>
         <button class="primary" data-act="finish">Beenden</button>
       </div>`
    : `<div class="wk-head">
         <button class="ghost" data-act="closeEdit">‹ Zurück</button>
         <div class="btn-row"><button class="ghost" data-act="saveAsTpl">Als Vorlage</button><button class="ghost danger" data-act="deleteWorkout">Löschen</button></div>
       </div>
       <input class="title-in" data-in="wname" value="${esc(w.name)}" aria-label="Name">
       <label class="field"><span>Datum</span><input type="date" data-ch="wdate" value="${dateKey(new Date(w.start))}"></label>
       <div style="height:12px"></div>`;
  return head +
    w.entries.map((en, i) => entryCard(w, en, i)).join('') +
    `<button class="wide add" data-act="pickEx" data-target="workout">+ Übung hinzufügen</button>
     <label class="field"><span>Notiz</span><textarea data-in="wnote" rows="2" placeholder="Wie lief's? Energie, Schlaf, Schmerzen …">${esc(w.note)}</textarea></label>
     ${isActive ? '<button class="ghost danger wide" data-act="discard">Training verwerfen</button>' : ''}`;
}

function entryCard(w, en, i) {
  const ex = exById(en.exerciseId);
  const prev = lastEntryFor(en.exerciseId, w.start, w.id);
  const pSets = prev ? doneSets(prev) : [];
  const stuck = stuckIn(sessionsFor(en.exerciseId, w.id).filter(x => x.ts < w.start));
  const rows = en.sets.map((s, j) => {
    const p = pSets[j];
    const pp = p || pSets.at(-1);
    return `
      <div class="set${s.done ? ' done' : ''}">
        <span class="no">${j + 1}</span>
        <span class="prev">${p ? `${fmt(p.w || 0, 2)} × ${p.r}` : '–'}</span>
        <input data-in="sw" data-e="${i}" data-s="${j}" inputmode="decimal" autocomplete="off" value="${fmtIn(s.w)}" placeholder="${pp ? fmtIn(pp.w || 0) : 'kg'}" aria-label="Gewicht Satz ${j + 1}">
        <input data-in="sr" data-e="${i}" data-s="${j}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${s.r ?? ''}" placeholder="${pp ? pp.r : 'Wdh'}" aria-label="Wiederholungen Satz ${j + 1}">
        <button class="check" data-act="toggleSet" data-e="${i}" data-s="${j}" aria-label="Satz erledigt">✓</button>
      </div>`;
  }).join('');
  return `
    <section class="card entry">
      <div class="entry-head">
        <div>
          <h3>${esc(ex.name)}</h3>
          <div class="hint">${hintFor(ex, prev)}</div>
          ${stuck ? '<div class="hint warn">⚠ Seit 3 Einheiten kein neuer Bestwert. Tipps unter „Fortschritt“.</div>' : ''}
        </div>
        <div class="entry-tools">
          <button class="icon" data-act="moveEntry" data-e="${i}" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon" data-act="removeEntry" data-e="${i}" aria-label="Übung entfernen">✕</button>
        </div>
      </div>
      <div class="set head"><span>#</span><span>Letztes Mal</span><span>kg</span><span>Wdh</span><span></span></div>
      ${rows}
      <div class="entry-foot">
        <button class="ghost" data-act="removeSet" data-e="${i}">− Satz</button>
        <button class="ghost" data-act="addSet" data-e="${i}">+ Satz</button>
      </div>
    </section>`;
}

function summaryHtml(w) {
  const sets = w.entries.flatMap(doneSets);
  const prs = [];
  for (const id of new Set(w.entries.map(e => e.exerciseId))) {
    const mine = w.entries.filter(e => e.exerciseId === id).flatMap(doneSets);
    const bestSet = mine.reduce((a, s) => e1rm(s.w, s.r) > e1rm(a.w, a.r) ? s : a, mine[0]);
    const before = sessionsFor(id, w.id).filter(x => x.ts < w.start);
    const best = e1rm(bestSet.w, bestSet.r);
    if (before.length && best > Math.max(...before.map(x => x.best))) {
      prs.push(`<li><b>${esc(exById(id).name)}</b>: ${fmt(bestSet.w, 2)} kg × ${bestSet.r} (≈ ${fmt(best, 0)} kg 1RM)</li>`);
    }
  }
  return `
    <div class="summary">
      <div class="big">💪</div>
      <h2>Training gespeichert</h2>
      <div class="stats">
        <div><span>Dauer</span><b>${fmtDur(w.end - w.start)}</b></div>
        <div><span>Sätze</span><b>${sets.length}</b></div>
        <div><span>Volumen</span><b>${fmt(sum(sets, s => (s.w || 0) * s.r), 0)} kg</b></div>
        <div><span>Neue Bestwerte</span><b>${prs.length}</b></div>
      </div>
      ${prs.length ? `<h3>🏆 Neue Bestwerte</h3><ul>${prs.join('')}</ul>` : ''}
      <p class="muted small">Denk dran, heute noch Gewicht, Protein und Kalorien unter „Tag“ einzutragen.</p>
      <button class="primary wide" data-act="closeSheet">Fertig</button>
    </div>`;
}

/* ---------- Übungsauswahl ---------- */

function openPicker(target) {
  ui.pick = { target, q: '' };
  openSheet(`
    <div class="sheet-head"><h2>Übung wählen</h2><button class="ghost" data-act="closeSheet">Fertig</button></div>
    <input class="search" data-in="pickq" placeholder="Suchen oder neu anlegen …" autocomplete="off" enterkeyhint="search">
    <div id="pick-list">${pickList()}</div>`);
}

function pickList() {
  const q = ui.pick.q.trim().toLowerCase();
  const tpl = ui.pick.target !== 'workout' ? db.templates.find(t => t.id === ui.pick.target) : null;
  const inUse = new Set(tpl ? tpl.exerciseIds : (cur()?.entries.map(e => e.exerciseId) || []));
  const exs = db.exercises.filter(e => !e.archived && (!q || e.name.toLowerCase().includes(q)));
  let html = '';
  if (q && !db.exercises.some(e => !e.archived && e.name.toLowerCase() === q)) {
    html += `<button class="pick new" data-act="pickNew">+ „${esc(ui.pick.q.trim())}“ als neue Übung anlegen</button>`;
  }
  for (const g of GROUPS) {
    const list = exs.filter(e => groupOf(e) === g).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!list.length) continue;
    html += `<div class="pick-group">${g}</div>` + list.map(e =>
      `<button class="pick${inUse.has(e.id) ? ' on' : ''}" data-act="pickOne" data-id="${e.id}">${esc(e.name)}<span>${inUse.has(e.id) ? '✓ drin' : `${e.repMin}–${e.repMax} Wdh`}</span></button>`
    ).join('');
  }
  return html || '<p class="empty">Nichts gefunden.</p>';
}

function addPicked(id) {
  if (ui.pick.target === 'workout') {
    const w = cur();
    w.entries.push(newEntry(id, w));
    save();
    closeSheet();
    render();
    const cards = document.querySelectorAll('.entry');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    const t = db.templates.find(x => x.id === ui.pick.target);
    if (t.exerciseIds.includes(id)) return toast('Ist schon in der Vorlage');
    t.exerciseIds.push(id);
    save();
    $('#pick-list').innerHTML = pickList();
    render();
  }
}

/* ================= Ansicht: Tag ================= */

function latestWeight() {
  const k = Object.keys(db.days).filter(k => db.days[k].weight > 0).sort().at(-1);
  return k ? db.days[k].weight : null;
}

function meter(label, val, goal, unit) {
  const pct = goal ? Math.min(100, val / goal * 100) : 0;
  const over = goal && unit === 'kcal' && val > goal * 1.1;
  return `
    <div class="meter${over ? ' over' : ''}">
      <div class="meter-top"><span>${label}</span><span><b>${fmt(val, 0)}</b>${goal ? ' / ' + fmt(goal, 0) : ''} ${unit}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>`;
}

function recentFoods() {
  const seen = new Map();
  for (const k of Object.keys(db.days).sort().reverse()) {
    for (const f of (db.days[k].food || []).slice().reverse()) {
      const key = (f.label || '').trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, f);
      if (seen.size >= 8) return [...seen.values()];
    }
  }
  return [...seen.values()];
}

function viewDay() {
  if (ui.dayFollow) ui.day = dateKey();
  const k = ui.day, d = db.days[k] || {}, s = db.settings;
  const tot = foodTotals(d);
  const isToday = k === dateKey();
  const ws = finished().filter(w => dateKey(new Date(w.start)) === k);
  const lw = latestWeight();
  const chips = recentFoods();
  return `
    <h1>Tag</h1>
    <div class="daynav">
      <button class="icon" data-act="dayShift" data-n="-1" aria-label="Vorheriger Tag">‹</button>
      <button class="ghost" data-act="dayToday"><b>${isToday ? 'Heute' : fmtDay(keyToDate(k).getTime())}</b>${isToday ? '' : ' <span class="muted small">→ heute</span>'}</button>
      <button class="icon" data-act="dayShift" data-n="1" aria-label="Nächster Tag" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    <section class="card">
      <h2>Körper</h2>
      <div class="grid2">
        <label class="field"><span>Körpergewicht (kg)</span><input inputmode="decimal" data-in="day" data-f="weight" value="${fmtIn(d.weight)}" placeholder="${lw ? fmtIn(lw) : 'z. B. 80,5'}" autocomplete="off"></label>
        <label class="field"><span>Schlaf (Stunden)</span><input inputmode="decimal" data-in="day" data-f="sleep" value="${fmtIn(d.sleep)}" placeholder="z. B. 7,5" autocomplete="off"></label>
      </div>
      <p class="muted small" style="margin:10px 0 0">Am besten morgens nach dem Aufstehen wiegen. Der Wochenschnitt unter „Fortschritt“ glättet Schwankungen.</p>
    </section>
    <section class="card">
      <h2>Ernährung</h2>
      ${meter('Protein', tot.p, s.proteinGoal, 'g')}
      ${meter('Kalorien', tot.k, s.kcalGoal, 'kcal')}
      <div>${(d.food || []).map(f => `
        <div class="food">
          <span>${esc(f.label || 'Eintrag')}</span>
          <span class="muted small">${fmt(f.p, 0)} g · ${fmt(f.k, 0)} kcal</span>
          <button class="icon" data-act="delFood" data-id="${f.id}" aria-label="Löschen">✕</button>
        </div>`).join('')}</div>
      <div class="food-add">
        <input class="lbl" id="f-label" placeholder="Bezeichnung, z. B. Mittagessen (optional)" autocomplete="off">
        <input id="f-p" inputmode="decimal" placeholder="Protein (g)" autocomplete="off">
        <input id="f-k" inputmode="decimal" placeholder="Kalorien" autocomplete="off">
        <button class="primary" data-act="addFood" aria-label="Hinzufügen">+</button>
      </div>
      ${chips.length ? `<div class="chips">${chips.map(f => `<button class="chip" data-act="repeatFood" data-label="${esc(f.label)}" data-p="${f.p || 0}" data-k="${f.k || 0}">+ ${esc(f.label)} <small>${fmt(f.p, 0)} g</small></button>`).join('')}</div>` : ''}
      <p class="muted small" style="margin:12px 0 0">Du kannst über den Tag einzelne Mahlzeiten eintragen oder abends einfach die Tagessumme als einen Eintrag.</p>
    </section>
    <section class="card">
      <h2>Notiz</h2>
      <textarea data-in="day" data-f="note" rows="2" placeholder="Energie, Stress, Besonderheiten …">${esc(d.note)}</textarea>
    </section>
    ${ws.length ? `<h2 class="sec">Training an diesem Tag</h2>${ws.map(historyItem).join('')}` : ''}`;
}

function getDay(k) {
  return db.days[k] ||= { food: [] };
}

/* ================= Ansicht: Fortschritt ================= */

function chart(series, { goal = null, digits = 0 } = {}) {
  const all = series.flatMap(s => s.pts);
  if (all.length < 2) return '<p class="empty">Noch zu wenig Daten für eine Kurve. Ab zwei Einträgen geht\'s los.</p>';
  const W = 340, H = 170, L = 36, R = 8, T = 10, B = 22;
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  if (goal != null) ys.push(goal);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x1 === x0) x1 = x0 + DAY;
  const padY = (y1 - y0) * 0.12 || Math.max(1, y1 * 0.05);
  y0 -= padY; y1 += padY;
  const sx = x => (L + (x - x0) / (x1 - x0) * (W - L - R)).toFixed(1);
  const sy = y => (T + (1 - (y - y0) / (y1 - y0)) * (H - T - B)).toFixed(1);
  const grid = [0, 0.5, 1].map(f => {
    const v = y0 + f * (y1 - y0);
    return `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text class="axis" x="${L - 5}" y="${+sy(v) + 3.5}" text-anchor="end">${fmt(v, digits)}</text>`;
  }).join('');
  const goalLn = goal != null ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${sy(goal)}" y2="${sy(goal)}"/>` : '';
  const lines = series.map(s => {
    if (!s.pts.length) return '';
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join('');
    const dots = s.dots ? s.pts.map(p => `<circle class="dot ${s.cls}" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${s.cls === 'm' ? 2 : 3}"/>`).join('') : '';
    return (s.line === false ? '' : `<path class="ln ${s.cls}" d="${d}"/>`) + dots;
  }).join('');
  const xl = `<text class="axis" x="${L}" y="${H - 6}">${fmtShort(x0)}</text><text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShort(x1)}</text>`;
  const legend = series.map(s => `<span><i class="${s.cls}"></i>${s.name}</span>`).join('') + (goal != null ? '<span><i class="g"></i>Ziel</span>' : '');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${goalLn}${lines}${xl}</svg><div class="legend">${legend}</div>`;
}

function viewProgress() {
  const now = Date.now(), s = db.settings;
  const wk = finished().filter(w => w.start > now - 7 * DAY);
  const keys7 = lastDays(7), keysPrev = lastDays(14).slice(7);
  const avgOf = (keys, f) => {
    const v = keys.map(k => db.days[k]).filter(Boolean).map(f).filter(x => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const pAvg = avgOf(keys7, d => foodTotals(d).p);
  const kAvg = avgOf(keys7, d => foodTotals(d).k);
  const slAvg = avgOf(keys7, d => d.sleep);
  const wNow = avgOf(keys7, d => d.weight), wPrev = avgOf(keysPrev, d => d.weight);
  const delta = wNow && wPrev ? wNow - wPrev : null;

  // Sätze pro Muskelgruppe (7 Tage)
  const gs = Object.fromEntries(GROUPS.map(g => [g, 0]));
  wk.forEach(w => w.entries.forEach(e => { gs[groupOf(exById(e.exerciseId))] += doneSets(e).length; }));
  const groupBars = GROUPS.filter(g => g !== 'Sonstige' || gs[g]).map(g =>
    `<div class="gbar"><span>${g}</span><div class="gtrack"><div class="zone"></div><i style="width:${Math.min(100, gs[g] / 25 * 100)}%"></i></div><b>${gs[g]}</b></div>`
  ).join('');

  const trained = db.exercises.map(e => ({ e, s: sessionsFor(e.id) })).filter(x => x.s.length);
  const stuck = trained.filter(x => stuckIn(x.s));
  trained.sort((a, b) => b.s.at(-1).ts - a.s.at(-1).ts);
  if (!trained.some(x => x.e.id === ui.progEx)) ui.progEx = trained[0]?.e.id ?? null;
  const sel = trained.find(x => x.e.id === ui.progEx);

  let exHtml = '<p class="empty">Sobald du Trainings beendet hast, siehst du hier deine Kurven.</p>';
  if (sel) {
    const ss = sel.s;
    const allSets = ss.flatMap(x => x.sets);
    const bodyweight = ss.every(x => x.topW === 0);
    const bestSet = allSets.reduce((a, x) => (bodyweight ? x.r > a.r : e1rm(x.w, x.r) > e1rm(a.w, a.r)) ? x : a, allSets[0]);
    const first = ss[0], last = ss.at(-1);
    const change = bodyweight
      ? (first.maxR ? (last.maxR / first.maxR - 1) * 100 : null)
      : (first.best ? (last.best / first.best - 1) * 100 : null);
    const series = bodyweight
      ? [{ name: 'Max. Wdh', cls: 'a', dots: true, pts: ss.map(x => ({ x: x.ts, y: x.maxR })) }]
      : [
          { name: 'geschätztes 1RM', cls: 'a', dots: true, pts: ss.map(x => ({ x: x.ts, y: x.best })) },
          { name: 'Top-Gewicht', cls: 'b', dots: false, pts: ss.map(x => ({ x: x.ts, y: x.topW })) },
        ];
    exHtml = `
      ${chart(series)}
      <div class="stats" style="margin-top:12px">
        <div><span>${bodyweight ? 'Meiste Wdh' : 'Bestes 1RM (geschätzt)'}</span><b>${bodyweight ? bestSet.r : fmt(e1rm(bestSet.w, bestSet.r), 1) + ' kg'}</b></div>
        <div><span>Bester Satz</span><b>${fmt(bestSet.w || 0, 2)} kg × ${bestSet.r}</b></div>
        <div><span>Einheiten</span><b>${ss.length}</b></div>
        <div><span>Seit der ersten Einheit</span><b>${change == null ? '–' : (change >= 0 ? '+' : '') + fmt(change, 0) + ' %'}</b></div>
      </div>
      <h2 class="sec" style="margin-inline:0">Letzte Einheiten</h2>
      ${ss.slice(-5).reverse().map(x => `<div class="sess"><span>${fmtDay(x.ts)}</span><span>${x.sets.map(t => `${fmt(t.w || 0, 2)}×${t.r}`).join(' · ')}</span></div>`).join('')}`;
  }

  const wpts = Object.keys(db.days)
    .filter(k => db.days[k].weight > 0 && keyToDate(k).getTime() > now - 180 * DAY)
    .sort()
    .map(k => ({ x: keyToDate(k).getTime(), y: db.days[k].weight }));
  const avg7 = wpts.map(p => {
    const win = wpts.filter(q => q.x <= p.x && q.x > p.x - 7 * DAY);
    return { x: p.x, y: sum(win, q => q.y) / win.length };
  });

  return `
    <h1>Fortschritt</h1>
    <section class="card">
      <h2>Letzte 7 Tage</h2>
      <div class="stats">
        <div><span>Trainings</span><b>${wk.length}</b></div>
        <div><span>Ø Gewicht</span><b>${wNow ? fmt(wNow, 1) + ' kg' : '–'}</b>${delta != null ? ` <small>${delta >= 0 ? '+' : ''}${fmt(delta, 1)} zur Vorwoche</small>` : ''}</div>
        <div><span>Ø Protein</span><b>${pAvg ? fmt(pAvg, 0) + ' g' : '–'}</b>${s.proteinGoal ? ` <small>Ziel ${s.proteinGoal}</small>` : ''}</div>
        <div><span>Ø Kalorien</span><b>${kAvg ? fmt(kAvg, 0) : '–'}</b>${s.kcalGoal ? ` <small>Ziel ${s.kcalGoal}</small>` : ''}</div>
        <div><span>Ø Schlaf</span><b>${slAvg ? fmt(slAvg, 1) + ' h' : '–'}</b></div>
        <div><span>Sätze gesamt</span><b>${sum(wk, w => w.entries.flatMap(doneSets).length)}</b></div>
      </div>
    </section>
    <section class="card">
      <h2>Harte Sätze pro Muskelgruppe (7 Tage)</h2>
      ${groupBars}
      <p class="muted small" style="margin:8px 0 0">Der helle Bereich markiert <b>10–20 Sätze pro Woche</b>, eine bewährte Spanne für Muskelaufbau.</p>
    </section>
    ${stuck.length ? `
    <section class="card warnc">
      <h2>⚠ Hier stagnierst du</h2>
      <p class="muted small" style="margin:0">Seit 3 Einheiten kein neuer Bestwert:</p>
      <ul>${stuck.map(x => `<li><b>${esc(x.e.name)}</b>, Bestwert ≈ ${fmt(Math.max(...x.s.map(y => y.best)), 0)} kg (1RM)</li>`).join('')}</ul>
      <details>
        <summary>Was gegen Plateaus hilft</summary>
        <ul class="small">
          <li><b>Doppelte Progression:</b> erst die Wdh im Zielbereich steigern, dann das Gewicht. Die App zeigt dir bei jeder Übung das Ziel.</li>
          <li><b>Deload:</b> eine Woche mit ca. 10 % weniger Gewicht oder halb so vielen Sätzen, danach neu anlaufen.</li>
          <li><b>Variation:</b> Wdh-Bereich wechseln (z. B. 5×5 statt 3×10) oder eine verwandte Übung nehmen.</li>
          <li><b>Volumen:</b> 10–20 harte Sätze pro Muskelgruppe und Woche (siehe oben).</li>
          <li><b>Erholung:</b> genug Protein${s.proteinGoal ? ` (${s.proteinGoal} g)` : ''}, Kalorien und 7–9 h Schlaf. Im Kaloriendefizit ist Kraftaufbau schwer.</li>
        </ul>
      </details>
    </section>` : ''}
    <section class="card">
      <h2>Übung</h2>
      ${trained.length ? `<select data-ch="progEx">${trained.map(x => `<option value="${x.e.id}"${x.e.id === ui.progEx ? ' selected' : ''}>${esc(x.e.name)}</option>`).join('')}</select>` : ''}
      ${exHtml}
    </section>
    <section class="card">
      <h2>Körpergewicht</h2>
      ${chart([
        { name: 'Messung', cls: 'm', dots: true, line: false, pts: wpts },
        { name: '7-Tage-Schnitt', cls: 'a', pts: avg7 },
      ], { goal: s.weightGoal, digits: 1 })}
    </section>`;
}

/* ================= Ansicht: Mehr ================= */

const tplCur = () => db.templates.find(t => t.id === ui.sub.slice(4));

function viewMore() {
  if (ui.sub === 'exercises') return viewExercises();
  if (ui.sub === 'templates') return viewTemplates();
  if (ui.sub.startsWith('tpl:')) return viewTemplate();
  const s = db.settings;
  const lw = latestWeight();
  const field = (label, f, ph) => `<label class="field"><span>${label}</span><input inputmode="decimal" data-in="set" data-f="${f}" value="${fmtIn(s[f])}" placeholder="${ph}" autocomplete="off"></label>`;
  return `
    <h1>Mehr</h1>
    <section class="card">
      <h2>Ziele</h2>
      <div class="grid2">
        ${field('Protein pro Tag (g)', 'proteinGoal', '150')}
        ${field('Kalorien pro Tag', 'kcalGoal', '2500')}
        ${field('Zielgewicht (kg)', 'weightGoal', 'optional')}
      </div>
      <p class="muted small" style="margin:10px 0 0">Faustregel für Muskelaufbau: 1,6–2,2 g Protein pro kg Körpergewicht${lw ? `, bei ${fmt(lw)} kg also ca. ${Math.round(lw * 1.6)}–${Math.round(lw * 2.2)} g` : ''}.</p>
    </section>
    <section class="card">
      <h2>Training</h2>
      <div class="grid2">
        ${field('Pause (Sekunden)', 'restSec', '120')}
        ${field('Steigerung (kg)', 'increment', '2,5')}
      </div>
      <p class="muted small" style="margin:10px 0 0">Der Pausentimer startet automatisch, wenn du einen Satz abhakst. 0 = aus.</p>
    </section>
    <section class="card list">
      <button class="row-btn" data-act="sub" data-sub="templates"><span class="grow">Vorlagen</span><span>${db.templates.length} ›</span></button>
      <button class="row-btn" data-act="sub" data-sub="exercises"><span class="grow">Übungen</span><span>${db.exercises.filter(e => !e.archived).length} ›</span></button>
    </section>
    <section class="card">
      <h2>Daten & Backup</h2>
      <p class="muted small" style="margin-top:0">Deine Daten liegen nur auf diesem Gerät, nicht auf einem Server. Exportiere regelmäßig ein Backup (z. B. in „Dateien“ oder iCloud Drive). Letztes Backup: <b>${s.lastBackup ? relDay(s.lastBackup) : 'noch nie'}</b>.</p>
      <div class="btn-row">
        <button class="primary" data-act="export">Backup exportieren</button>
        <label class="btn">Backup laden<input class="vh" type="file" accept="application/json,.json" data-ch="import"></label>
      </div>
      <p class="muted small">${ui.persisted === true ? '✓ Speicher ist als dauerhaft markiert.' : isStandalone() ? '' : 'Tipp: Als Home-Bildschirm-App ist der Speicher am zuverlässigsten.'}</p>
    </section>
    <section class="card">
      <h2>Als App aufs iPhone</h2>
      <ol class="small">
        <li>Diese Seite in <b>Safari</b> öffnen.</li>
        <li>Unten auf das <b>Teilen</b>-Symbol tippen (Quadrat mit Pfeil).</li>
        <li><b>„Zum Home-Bildschirm“</b> wählen, dann „Hinzufügen“.</li>
        <li>Ab jetzt immer über das Icon starten. Die Home-Bildschirm-App hat ihren eigenen Speicher, getrennt von Safari.</li>
      </ol>
    </section>
    <button class="ghost danger wide" data-act="wipe">Alle Daten löschen</button>
    <p class="muted small center">Wiederholungstracker v${VERSION}</p>`;
}

function viewExercises() {
  return `
    <div class="wk-head"><button class="ghost" data-act="sub" data-sub="">‹ Mehr</button><button class="primary" data-act="editEx" data-id="">+ Neue Übung</button></div>
    <h1>Übungen</h1>
    ${GROUPS.map(g => {
      const list = db.exercises.filter(e => !e.archived && groupOf(e) === g).sort((a, b) => a.name.localeCompare(b.name, 'de'));
      return list.length ? `<h2 class="sec">${g}</h2><section class="card list">${list.map(e =>
        `<button class="row-btn" data-act="editEx" data-id="${e.id}"><span class="grow">${esc(e.name)}</span><span>${e.repMin}–${e.repMax} Wdh ›</span></button>`
      ).join('')}</section>` : '';
    }).join('')}`;
}

function openExEditor(id) {
  const e = id ? db.exercises.find(x => x.id === id) : { name: '', group: 'Brust', repMin: 8, repMax: 12 };
  openSheet(`
    <div class="sheet-head"><h2>${id ? 'Übung bearbeiten' : 'Neue Übung'}</h2><button class="ghost" data-act="closeSheet">Abbrechen</button></div>
    <label class="field"><span>Name</span><input id="ex-name" value="${esc(e.name)}" autocomplete="off"></label>
    <label class="field"><span>Muskelgruppe</span><select id="ex-group">${GROUPS.map(g => `<option${groupOf(e) === g ? ' selected' : ''}>${g}</option>`).join('')}</select></label>
    <div class="grid2" style="margin-top:10px">
      <label class="field"><span>Wdh von</span><input id="ex-min" inputmode="numeric" value="${e.repMin}"></label>
      <label class="field"><span>Wdh bis</span><input id="ex-max" inputmode="numeric" value="${e.repMax}"></label>
    </div>
    <p class="muted small">Der Wdh-Bereich steuert den Hinweis, wann du das Gewicht erhöhen solltest.</p>
    <button class="primary wide" data-act="saveEx" data-id="${id || ''}">Speichern</button>
    ${id ? `<button class="ghost danger wide" data-act="delEx" data-id="${id}">Übung löschen</button>` : ''}`);
}

function viewTemplates() {
  return `
    <div class="wk-head"><button class="ghost" data-act="sub" data-sub="">‹ Mehr</button><button class="primary" data-act="newTpl">+ Neue Vorlage</button></div>
    <h1>Vorlagen</h1>
    ${db.templates.length ? `<section class="card list">${db.templates.map(t =>
      `<button class="row-btn" data-act="sub" data-sub="tpl:${t.id}"><span class="grow"><b>${esc(t.name)}</b><br><span class="muted small">${t.exerciseIds.map(id => esc(exById(id).name)).join(', ') || 'leer'}</span></span><span>›</span></button>`
    ).join('')}</section>` : '<p class="empty">Noch keine Vorlagen.</p>'}
    <p class="muted small">Tipp: Du kannst auch ein vergangenes Training im Verlauf öffnen und „Als Vorlage“ speichern.</p>`;
}

function viewTemplate() {
  const t = tplCur();
  if (!t) { ui.sub = 'templates'; return viewTemplates(); }
  return `
    <div class="wk-head"><button class="ghost" data-act="sub" data-sub="templates">‹ Vorlagen</button><button class="ghost danger" data-act="delTpl">Löschen</button></div>
    <input class="title-in" data-in="tplname" value="${esc(t.name)}" aria-label="Name der Vorlage">
    <div style="height:14px"></div>
    <section class="card list">
      ${t.exerciseIds.map((id, i) => `
        <div class="row-btn">
          <span class="grow">${esc(exById(id).name)}</span>
          <button class="icon" data-act="tplMove" data-i="${i}" aria-label="Nach oben" ${i ? '' : 'disabled'}>↑</button>
          <button class="icon" data-act="tplRemove" data-i="${i}" aria-label="Entfernen">✕</button>
        </div>`).join('') || '<p class="empty">Noch keine Übungen.</p>'}
    </section>
    <button class="wide add" data-act="pickEx" data-target="${t.id}">+ Übung hinzufügen</button>`;
}

/* ================= Backup ================= */

async function exportData() {
  const json = JSON.stringify(db);
  const name = `wiederholungstracker-${dateKey()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const done = () => { db.settings.lastBackup = Date.now(); save(); render(); toast('Backup erstellt'); };
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Wiederholungstracker Backup' }); done(); }
    catch (e) { if (e.name !== 'AbortError') toast('Teilen fehlgeschlagen'); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  done();
}

function importData(_, el) {
  const f = el.files[0];
  el.value = '';
  if (!f) return;
  f.text().then(text => {
    const d = JSON.parse(text);
    if (!Array.isArray(d.workouts) || !Array.isArray(d.exercises)) throw new Error('format');
    if (!confirm(`Backup mit ${d.workouts.length} Trainings laden? Die aktuellen Daten auf diesem Gerät werden ersetzt.`)) return;
    db = d;
    db.settings = { ...DEFAULT_SETTINGS, ...d.settings };
    db.days ||= {};
    db.templates ||= [];
    ui.editId = null;
    save();
    render();
    toast('Backup geladen');
  }).catch(() => toast('Die Datei ist kein gültiges Backup'));
}

/* ================= Aktionen ================= */

const actions = {
  tab({ tab }) {
    if (ui.tab === tab) { ui.editId = null; ui.sub = ''; }
    ui.tab = tab;
    history.replaceState(null, '', '#' + tab);
    render();
    scrollTo(0, 0);
  },
  start({ tpl }) {
    if (active()) return toast('Es läuft schon ein Training');
    startWorkout(tpl);
  },
  openWorkout({ id }) { ui.tab = 'train'; ui.editId = id; render(); scrollTo(0, 0); },
  closeEdit() { ui.editId = null; render(); },
  moreHist() { ui.histLimit += 20; render(); },
  pickEx({ target }) { openPicker(target); },
  pickOne({ id }) { addPicked(id); },
  pickNew() {
    const ex = { id: uid(), name: ui.pick.q.trim(), group: 'Sonstige', repMin: 8, repMax: 12 };
    db.exercises.push(ex);
    addPicked(ex.id);
  },
  closeSheet,

  toggleSet({ e, s }) {
    const w = cur(), en = w.entries[e], set = en.sets[s];
    if (set.done) { set.done = false; save(); return render(); }
    const pSets = prevSetsFor(w, en);
    const pp = pSets[s] || pSets.at(-1);
    if (set.w == null) set.w = pp ? (pp.w || 0) : 0;
    if (set.r == null && pp) set.r = pp.r;
    if (!set.r) { toast('Bitte erst die Wiederholungen eintragen'); return; }
    set.done = true;
    checkPR(w, en, set);
    save();
    if (w.id === db.activeId) startRest();
    render();
  },
  addSet({ e }) {
    const sets = cur().entries[e].sets, last = sets.at(-1);
    sets.push({ w: last?.w ?? null, r: last?.r ?? null, done: false });
    save(); render();
  },
  removeSet({ e }) {
    const sets = cur().entries[e].sets;
    if (sets.length <= 1) return actions.removeEntry({ e });
    sets.pop();
    save(); render();
  },
  removeEntry({ e }) {
    const w = cur();
    if (!confirm(`„${exById(w.entries[e].exerciseId).name}“ aus dem Training entfernen?`)) return;
    w.entries.splice(e, 1);
    save(); render();
  },
  moveEntry({ e }) {
    const list = cur().entries, i = +e;
    if (i < 1) return;
    [list[i - 1], list[i]] = [list[i], list[i - 1]];
    save(); render();
  },

  restAdj({ n }) {
    if (!rest) return;
    rest.end += +n * 1000;
    rest.total = Math.max(rest.total, rest.end - Date.now());
    tick();
  },
  restSkip() { rest = null; tick(); },

  finish() {
    const w = active();
    if (!w.entries.flatMap(doneSets).length) {
      if (confirm('Noch kein Satz abgehakt. Training verwerfen?')) actions.discard(true);
      return;
    }
    const open = sum(w.entries, e => e.sets.filter(s => !s.done).length);
    if (open && !confirm(`${open} ${open === 1 ? 'Satz ist' : 'Sätze sind'} nicht abgehakt und ${open === 1 ? 'wird' : 'werden'} nicht gespeichert. Training beenden?`)) return;
    w.entries = w.entries.map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length);
    w.end = Date.now();
    db.activeId = null;
    rest = null;
    save();
    render();
    scrollTo(0, 0);
    openSheet(summaryHtml(w));
  },
  discard(skipConfirm) {
    if (skipConfirm !== true && !confirm('Training verwerfen? Alle Sätze gehen verloren.')) return;
    db.workouts = db.workouts.filter(w => w.id !== db.activeId);
    db.activeId = null;
    rest = null;
    save(); render();
  },
  deleteWorkout() {
    if (!confirm('Dieses Training endgültig löschen?')) return;
    db.workouts = db.workouts.filter(w => w.id !== ui.editId);
    ui.editId = null;
    save(); render();
  },
  saveAsTpl() {
    const w = cur();
    db.templates.push({ id: uid(), name: w.name, exerciseIds: [...new Set(w.entries.map(e => e.exerciseId))] });
    save();
    toast(`Vorlage „${w.name}“ gespeichert`);
  },

  dayShift({ n }) {
    const d = keyToDate(ui.day);
    d.setDate(d.getDate() + +n);
    if (d.getTime() > Date.now()) return;
    ui.day = dateKey(d);
    ui.dayFollow = ui.day === dateKey();
    render();
  },
  dayToday() { ui.day = dateKey(); ui.dayFollow = true; render(); },
  addFood() {
    const p = num($('#f-p').value), k = num($('#f-k').value);
    if (p == null && k == null) return toast('Protein oder Kalorien eintragen');
    getDay(ui.day).food ||= [];
    getDay(ui.day).food.push({ id: uid(), label: $('#f-label').value.trim(), p: p || 0, k: k || 0 });
    save(); render();
  },
  repeatFood({ label, p, k }) {
    getDay(ui.day).food ||= [];
    getDay(ui.day).food.push({ id: uid(), label, p: +p, k: +k });
    save(); render();
    toast(`${label} hinzugefügt`);
  },
  delFood({ id }) {
    const d = getDay(ui.day);
    d.food = (d.food || []).filter(f => f.id !== id);
    save(); render();
  },

  sub({ sub }) { ui.sub = sub; render(); scrollTo(0, 0); },
  editEx({ id }) { openExEditor(id); },
  saveEx({ id }) {
    const name = $('#ex-name').value.trim();
    if (!name) return toast('Bitte einen Namen eingeben');
    let repMin = Math.round(num($('#ex-min').value) || 8), repMax = Math.round(num($('#ex-max').value) || 12);
    if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
    const data = { name, group: $('#ex-group').value, repMin, repMax };
    if (id) Object.assign(db.exercises.find(e => e.id === id), data);
    else db.exercises.push({ id: uid(), ...data });
    save(); closeSheet(); render();
  },
  delEx({ id }) {
    const ex = db.exercises.find(e => e.id === id);
    if (!confirm(`„${ex.name}“ löschen? Vergangene Trainings bleiben erhalten.`)) return;
    const used = db.workouts.some(w => w.entries.some(e => e.exerciseId === id));
    if (used) ex.archived = true;
    else db.exercises = db.exercises.filter(e => e.id !== id);
    db.templates.forEach(t => { t.exerciseIds = t.exerciseIds.filter(x => x !== id); });
    save(); closeSheet(); render();
  },
  newTpl() {
    const t = { id: uid(), name: 'Neue Vorlage', exerciseIds: [] };
    db.templates.push(t);
    save();
    ui.sub = 'tpl:' + t.id;
    render();
  },
  tplMove({ i }) {
    const list = tplCur().exerciseIds, n = +i;
    if (n < 1) return;
    [list[n - 1], list[n]] = [list[n], list[n - 1]];
    save(); render();
  },
  tplRemove({ i }) { tplCur().exerciseIds.splice(+i, 1); save(); render(); },
  delTpl() {
    const t = tplCur();
    if (!confirm(`Vorlage „${t.name}“ löschen?`)) return;
    db.templates = db.templates.filter(x => x !== t);
    ui.sub = 'templates';
    save(); render();
  },

  export: exportData,
  dismissInstall() { db.settings.hideInstall = true; save(); render(); },
  wipe() {
    if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
    if (!confirm('Ganz sicher? Mach vorher lieber ein Backup.')) return;
    localStorage.removeItem(STORE_KEY);
    load();
    ui.editId = null; ui.sub = '';
    render();
    toast('Alle Daten gelöscht');
  },
};

const inputs = {
  sw({ e, s }, el) { cur().entries[e].sets[s].w = num(el.value); save(); },
  sr({ e, s }, el) { const v = num(el.value); cur().entries[e].sets[s].r = v == null ? null : Math.round(v); save(); },
  wnote(_, el) { cur().note = el.value; save(); },
  wname(_, el) { cur().name = el.value; save(); },
  day({ f }, el) { getDay(ui.day)[f] = f === 'note' ? el.value : num(el.value); save(); },
  set({ f }, el) { db.settings[f] = num(el.value); save(); },
  pickq(_, el) { ui.pick.q = el.value; $('#pick-list').innerHTML = pickList(); },
  tplname(_, el) { tplCur().name = el.value; save(); },
};

const changes = {
  wdate(_, el) {
    const w = cur();
    const [y, m, d] = el.value.split('-').map(Number);
    if (!y) return;
    const dt = new Date(w.start), dur = w.end ? w.end - w.start : 0;
    dt.setFullYear(y, m - 1, d);
    w.start = dt.getTime();
    if (w.end) w.end = w.start + dur;
    save(); render();
  },
  progEx(_, el) { ui.progEx = el.value; render(); },
  import: importData,
};

document.addEventListener('click', ev => {
  if (ev.target.id === 'sheet') return closeSheet();
  const el = ev.target.closest('[data-act]');
  if (el && !el.disabled) actions[el.dataset.act]?.(el.dataset, el);
});
document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-in]');
  if (el) inputs[el.dataset.in]?.(el.dataset, el);
});
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-ch]');
  if (el) changes[el.dataset.ch]?.(el.dataset, el);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.closest('.food-add')) { ev.preventDefault(); actions.addFood(); }
});
// App kommt aus dem Hintergrund zurück (z. B. am nächsten Tag)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !document.activeElement?.matches('input, textarea')) render();
});

/* ================= Start ================= */

load();
const startTab = location.hash.slice(1);
if (['train', 'day', 'progress', 'more'].includes(startTab)) ui.tab = startTab;
render();

navigator.storage?.persist?.().then(ok => { ui.persisted = ok; }).catch(() => {});
navigator.serviceWorker?.register('sw.js').catch(() => {});
