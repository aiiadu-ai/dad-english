const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const learning = require('./learning');
const quiz = require('./quiz');

const W = (en, uk, type = 'noun') => ({ en, uk, type });
const sample = [
  W('customer', 'клієнт'),
  W('client', 'клієнт'),
  W('solution', 'рішення'),
  W('decision', 'рішення'),
  W('error', 'помилка'),
  W('mistake', 'помилка'),
  W('price', 'ціна'),
  W('cost', 'вартість, витрати'),
  W('deal', 'угода'),
  W('agreement', 'угода'),
  W('go', 'іти', 'verb'),
  W('call', 'телефонувати', 'verb'),
  W('call', 'дзвінок'),
];

// детермінований "випадковий" генератор, щоб тести повторювалися однаково
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function stateWith(entries) {
  const st = learning.newState();
  for (const [w, status] of entries) st.words[learning.wordKey(w)] = { status };
  return st;
}

test('pickQuizWord: без бачених слів питання немає', () => {
  assert.equal(quiz.pickQuizWord(learning.newState(), sample), null);
});

test('pickQuizWord: питання лише з бачених слів', () => {
  const st = stateWith([[sample[6], 'again']]);
  for (let i = 0; i < 20; i++) assert.equal(quiz.pickQuizWord(st, sample), sample[6]);
});

test('pickQuizWord: вивчені слова — рідко, десь раз на learnedEvery', () => {
  const st = stateWith([
    [sample[6], 'again'],
    [sample[7], 'waiting'],
    [sample[8], 'learned'],
  ]);
  const rand = seeded(7);
  let learned = 0;
  const N = 6000;
  for (let i = 0; i < N; i++) {
    if (quiz.pickQuizWord(st, sample, rand, 17) === sample[8]) learned++;
  }
  const share = learned / N;
  assert.ok(share > 1 / 25 && share < 1 / 12, `частка вивчених ${share}`);
});

test('pickQuizWord: якщо є лише вивчені — питаємо їх', () => {
  const st = stateWith([[sample[8], 'learned']]);
  assert.equal(quiz.pickQuizWord(st, sample), sample[8]);
});

test('pickQuizWord: не повторює попереднє слово, коли є вибір', () => {
  const st = stateWith([[sample[6], 'again'], [sample[7], 'again']]);
  for (let i = 0; i < 30; i++) {
    assert.equal(quiz.pickQuizWord(st, sample, Math.random, 17, sample[6]), sample[7]);
  }
});

test('buildQuiz: 4 різні варіанти, правильний є, у питанні — переклад', () => {
  for (let i = 0; i < 200; i++) {
    const q = quiz.buildQuiz(sample[6], sample, seeded(i + 1));
    assert.equal(q.question, 'ціна');
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options.includes('price'));
    assert.equal(q.answer, 'price');
  }
});

test('buildQuiz: немає двозначності — варіанти не мають спільного українського слова з питанням', () => {
  const pairs = [['customer', 'client'], ['solution', 'decision'], ['error', 'mistake'], ['deal', 'agreement']];
  for (const [a, b] of pairs) {
    const word = sample.find((w) => w.en === a);
    for (let i = 0; i < 200; i++) {
      const q = quiz.buildQuiz(word, sample, seeded(i + 11));
      assert.ok(q, `питання для ${a}`);
      assert.ok(!q.options.includes(b), `${b} не має бути серед варіантів до ${a}`);
    }
  }
});

test('buildQuiz: те саме англійське слово не стає хибним варіантом (call|noun і call|verb)', () => {
  const word = sample.find((w) => w.en === 'call' && w.type === 'verb');
  for (let i = 0; i < 100; i++) {
    const q = quiz.buildQuiz(word, sample, seeded(i + 3));
    assert.equal(q.options.filter((o) => o === 'call').length, 1);
  }
});

test('buildQuiz: тип слова збігається, коли слів цього типу достатньо', () => {
  const nouns = new Set(sample.filter((w) => w.type === 'noun').map((w) => w.en));
  for (let i = 0; i < 100; i++) {
    const q = quiz.buildQuiz(sample[6], sample, seeded(i + 5));
    for (const o of q.options) assert.ok(nouns.has(o), `${o} має бути іменником`);
  }
});

test('buildQuiz: замало слів — питання немає', () => {
  assert.equal(quiz.buildQuiz(sample[0], [sample[0], sample[2]]), null);
});

test('buildQuiz: правильна відповідь потрапляє на різні місця', () => {
  const places = new Set();
  for (let i = 0; i < 100; i++) {
    const q = quiz.buildQuiz(sample[6], sample, seeded(i + 100));
    places.add(q.options.indexOf('price'));
  }
  assert.equal(places.size, 4);
});

test('buildQuiz: на справжньому words.json немає двох правильних відповідей', () => {
  const words = JSON.parse(fs.readFileSync(path.join(__dirname, 'words.json'), 'utf8'));
  const rand = seeded(42);
  for (const w of words) {
    const q = quiz.buildQuiz(w, words, rand);
    assert.ok(q, `питання для ${w.en}`);
    assert.equal(new Set(q.options).size, 4);
    const asked = quiz.ukTokens(w.uk);
    for (const o of q.options) {
      if (o === w.en) continue;
      for (const other of words.filter((x) => x.en === o)) {
        for (const t of quiz.ukTokens(other.uk)) {
          assert.ok(!asked.has(t), `${w.en} (${w.uk}) і ${o} (${other.uk}) мають спільне «${t}»`);
        }
      }
    }
  }
});

const at = (h, m = 0) => new Date(2026, 10, 22, h, m, 0, 0).getTime();

test('nextQuizAt: випадкова хвилина в поточній годині, якщо вона ще попереду', () => {
  const t = quiz.nextQuizAt(at(14, 10), () => 0.5, false); // 14:30
  assert.equal(t, at(14, 30));
});

test('nextQuizAt: якщо момент уже минув — наступна година', () => {
  const t = quiz.nextQuizAt(at(14, 50), () => 0.5, false); // 14:30 вже було
  assert.equal(t, at(15, 30));
});

test('nextQuizAt: раз на 2 години — один тест на проміжок 14–16, наступний уже в 16–18', () => {
  assert.equal(quiz.nextQuizAt(at(14, 10), () => 0.5, false, 2), at(15, 0)); // середина проміжку 14–16
  assert.equal(quiz.nextQuizAt(at(15, 30), () => 0.5, false, 2), at(17, 0)); // 15:00 минуло → проміжок 16–18
  for (let i = 0; i < 300; i++) {
    const t = quiz.nextQuizAt(at(15, 30), seeded(i + 1), true, 2);
    assert.ok(t >= at(16, 0) && t < at(18, 0));
  }
});

test('nextQuizAt: проміжки рахуються від півночі, непарна година теж у своєму проміжку', () => {
  // 15:30 належить проміжку 14–16 (а не 15–17)
  const t = quiz.nextQuizAt(at(15, 30), () => 0.99, false, 2);
  assert.ok(t > at(15, 30) && t < at(16, 0));
});

test('nextQuizAt: після тесту наступний — точно в наступній годині, не в тій самій', () => {
  for (let i = 0; i < 300; i++) {
    const t = quiz.nextQuizAt(at(14, 5), seeded(i + 1), true);
    assert.ok(t >= at(15, 0) && t < at(16, 0));
  }
});
