// Логіка тесту (quiz). Без Electron — щоб її можна було тестувати окремо.
//
// Тест: показуємо українське слово і 4 англійські варіанти, правильний лише один.
// Питання беремо тільки зі слів, які вже показували (є запис у прогресі).

const { wordKey } = require('./learning');

const HOUR_MS = 60 * 60 * 1000;

// Вивчені слова (learned) у тесті трапляються рідко: в середньому одне на стільки питань
const DEFAULT_LEARNED_EVERY = 17;

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Слова українського перекладу: "вартість, витрати" -> {вартість, витрати}.
// Дуже короткі (на, до, з…) не рахуємо.
function ukTokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 2)
  );
}

// Обирає слово для питання. Повертає слово зі списку або null.
// Звичайні (Again / чекають повтору) — частіше, вивчені — раз на learnedEvery питань.
function pickQuizWord(state, words, rand = Math.random, learnedEvery = DEFAULT_LEARNED_EVERY, lastWord = null) {
  const entryOf = (w) => state.words[wordKey(w)];
  const seen = words.filter((w) => entryOf(w));
  const learned = seen.filter((w) => entryOf(w).status === 'learned');
  const active = seen.filter((w) => entryOf(w).status !== 'learned');

  let pool;
  if (learned.length && active.length) {
    pool = rand() < 1 / learnedEvery ? learned : active;
  } else {
    pool = learned.length ? learned : active;
  }
  if (pool.length > 1 && lastWord) pool = pool.filter((w) => w !== lastWord);
  if (!pool.length) return null;
  return pool[Math.floor(rand() * pool.length)];
}

// Складає питання: { question, options (4, перемішані), answer }.
// Неправильні варіанти: того ж типу (іменник до іменників), інше англійське слово
// і жодного спільного українського слова з питанням (customer/client — обидва «клієнт»).
function buildQuiz(word, words, rand = Math.random) {
  const askedTokens = ukTokens(word.uk);
  const ok = (w) => {
    if (w.en === word.en) return false; // call|noun і call|verb — те саме слово
    for (const t of ukTokens(w.uk)) if (askedTokens.has(t)) return false;
    return true;
  };

  const seenEn = new Set([word.en]);
  const pickWrong = (list) => {
    const out = [];
    for (const w of shuffle(list, rand)) {
      if (!ok(w) || seenEn.has(w.en)) continue;
      seenEn.add(w.en);
      out.push(w.en);
      if (out.length === 3) break;
    }
    return out;
  };

  const sameType = words.filter((w) => w.type === word.type);
  const wrong = pickWrong(sameType);
  if (wrong.length < 3) {
    // того ж типу замало — добираємо з решти
    wrong.push(...pickWrong(words.filter((w) => w.type !== word.type)).slice(0, 3 - wrong.length));
  }
  if (wrong.length < 3) return null; // у списку замало слів

  return {
    question: word.uk,
    options: shuffle([word.en, ...wrong], rand),
    answer: word.en,
  };
}

// Коли показати наступний тест: один на кожну календарну годину, у випадкову хвилину.
// skipCurrentHour = true — поточну годину вже відпрацювали, беремо наступну.
// Повертає момент часу (мс від епохи).
function nextQuizAt(now = Date.now(), rand = Math.random, skipCurrentHour = false) {
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const start = hourStart.getTime();

  if (!skipCurrentHour) {
    const candidate = start + Math.floor(rand() * HOUR_MS);
    if (candidate > now) return candidate;
  }
  return start + HOUR_MS + Math.floor(rand() * HOUR_MS);
}

module.exports = { DEFAULT_LEARNED_EVERY, ukTokens, pickQuizWord, buildQuiz, nextQuizAt };
