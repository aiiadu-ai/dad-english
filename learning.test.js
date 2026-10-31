// Запуск: node --test
const test = require('node:test');
const assert = require('node:assert');
const L = require('./learning');

const config = { reviewDays: 7, testMode: false, testReviewSeconds: 40 };
const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_000_000_000_000;

const mk = (en, type = 'noun', base) => ({ en, uk: en, type, ...(base ? { base } : {}) });
const WORDS = [mk('a'), mk('b'), mk('c'), mk('d'), mk('e'), mk('f'), mk('g')];

// Повторюємо вибір, поки не потрапимо на потрібне слово (нові слова випадкові)
function pickUntil(state, words, now, target) {
  for (let i = 0; i < 200; i++) {
    const p = L.pickWord(state, words, now);
    if (p && p.word.en === target) return p;
    if (!p) return null;
  }
  throw new Error('слово ' + target + ' не випало');
}

test('перший Know ховає слово на reviewDays, після тижня воно першим повертається', () => {
  const s = L.newState();
  L.answer(s, WORDS[0], 'know', T0, config);
  assert.equal(s.words['a|noun'].status, 'waiting');
  assert.equal(s.words['a|noun'].dueAt, T0 + 7 * DAY);

  // до терміну слово 'a' не показується
  for (let i = 0; i < 50; i++) {
    const p = L.pickWord(s, WORDS, T0 + 6 * DAY);
    assert.notEqual(p.word.en, 'a');
  }
  // після терміну — слово 'a' раніше за нові
  const p = L.pickWord(s, WORDS, T0 + 7 * DAY);
  assert.equal(p.word.en, 'a');
  assert.equal(p.kind, 'review');
});

test('Know на перевірці — вивчене назавжди', () => {
  const s = L.newState();
  L.answer(s, WORDS[0], 'know', T0, config);
  L.answer(s, WORDS[0], 'know', T0 + 7 * DAY, config);
  assert.equal(s.words['a|noun'].status, 'learned');
  for (let i = 0; i < 100; i++) {
    const p = L.pickWord(s, WORDS, T0 + 100 * DAY);
    assert.notEqual(p.word.en, 'a');
  }
});

test('Again на перевірці — у чергу повторів, цикл з нуля', () => {
  const s = L.newState();
  L.answer(s, WORDS[0], 'know', T0, config);
  L.answer(s, WORDS[0], 'again', T0 + 7 * DAY, config);
  assert.equal(s.words['a|noun'].status, 'again');
  assert.equal(s.words['a|noun'].dueAt, undefined);
  // Know після Again — знову перший Know: ховається ще на тиждень, а не "вивчене"
  L.answer(s, WORDS[0], 'know', T0 + 8 * DAY, config);
  assert.equal(s.words['a|noun'].status, 'waiting');
  assert.equal(s.words['a|noun'].dueAt, T0 + 15 * DAY);
});

test('Again повертається після 5 нових слів', () => {
  const s = L.newState();
  L.answer(s, WORDS[0], 'again', T0, config);
  const seen = [];
  // нові слова b..g: відповідаємо Know, щоб не збивати лічильник
  for (let i = 0; i < 6; i++) {
    const p = L.pickWord(s, WORDS, T0 + i);
    seen.push(p.kind);
    L.answer(s, p.word, 'know', T0 + i, config);
  }
  assert.deepEqual(seen.slice(0, 5), ['new', 'new', 'new', 'new', 'new']);
  assert.equal(seen[5], 'again');
});

test('слово на перевірці показується раніше за слово з черги повторів', () => {
  const s = L.newState();
  L.answer(s, WORDS[0], 'know', T0, config); // a: перевірка через тиждень
  L.answer(s, WORDS[1], 'again', T0, config); // b: в черзі
  s.newSinceRepeat = 5; // слот повтору вже "відкритий"
  const p = L.pickWord(s, WORDS, T0 + 7 * DAY);
  assert.equal(p.word.en, 'a');
  assert.equal(p.kind, 'review');
});

test('конструкція заблокована, поки на дієслові з base не було Know', () => {
  const words = [mk('go', 'verb'), mk('go on', 'phrase', 'go')];
  const s = L.newState();
  assert.equal(L.isUnlocked(words[1], words, s), false);
  for (let i = 0; i < 30; i++) assert.equal(L.pickWord(s, words, T0).word.en, 'go');

  L.answer(s, words[0], 'know', T0, config);
  assert.equal(L.isUnlocked(words[1], words, s), true);
  assert.equal(L.pickWord(s, words, T0 + 1).word.en, 'go on');
});

test('конструкція лишається розблокованою, навіть якщо дієслово пішло в Again', () => {
  const words = [mk('go', 'verb'), mk('go on', 'phrase', 'go')];
  const s = L.newState();
  L.answer(s, words[0], 'know', T0, config);
  L.answer(s, words[0], 'again', T0 + 1, config);
  assert.equal(L.isUnlocked(words[1], words, s), true);
});

test('Again на дієслові не розблоковує конструкцію', () => {
  const words = [mk('go', 'verb'), mk('go on', 'phrase', 'go')];
  const s = L.newState();
  L.answer(s, words[0], 'again', T0, config);
  assert.equal(L.isUnlocked(words[1], words, s), false);
});

test('нових немає, конструкції заблоковані → показуємо повтори, потім нічого', () => {
  const words = [mk('go', 'verb'), mk('go on', 'phrase', 'go')];
  const s = L.newState();
  L.answer(s, words[0], 'again', T0, config);
  const p = L.pickWord(s, words, T0 + 1);
  assert.equal(p.word.en, 'go');
  assert.equal(p.kind, 'again');
  // і так щоразу: заблокована конструкція 'go on' не виринає, нічого не ламається
  for (let i = 0; i < 20; i++) assert.equal(L.pickWord(s, words, T0 + 2 + i).word.en, 'go');
});

test('база конструкції відсутня у списку — не блокуємо', () => {
  const words = [mk('look up', 'phrase', 'zzz')];
  assert.equal(L.isUnlocked(words[0], words, L.newState()), true);
});

test('тестовий режим: затримка в секундах замість днів', () => {
  assert.equal(L.reviewDelayMs({ testMode: true, testReviewSeconds: 40, reviewDays: 7 }), 40_000);
  assert.equal(L.reviewDelayMs({ testMode: false, testReviewSeconds: 40, reviewDays: 7 }), 7 * DAY);
});

test('старий формат прогресу не переноситься', () => {
  const { state, legacy } = L.parseProgress({ known: ['apple|noun'], again: [], newSinceRepeat: 3 });
  assert.equal(legacy, true);
  assert.deepEqual(state.words, {});
  const ok = L.parseProgress({ version: 2, words: { 'a|noun': { status: 'learned' } }, newSinceRepeat: 1 });
  assert.equal(ok.legacy, false);
  assert.equal(ok.state.words['a|noun'].status, 'learned');
});

test('усе вивчене або чекає → нічого не показуємо', () => {
  const s = L.newState();
  for (const w of WORDS) L.answer(s, w, 'know', T0, config);
  assert.equal(L.pickWord(s, WORDS, T0 + 1), null);
});
