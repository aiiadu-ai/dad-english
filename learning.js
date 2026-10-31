// Логіка вивчення слів. Без Electron — щоб її можна було тестувати окремо.
//
// Стан кожного слова (state.words[ключ]):
//   немає запису — нове слово
//   waiting      — отримало Know, ховається до dueAt
//   again        — у черзі повторів
//   learned      — вивчене назавжди
// Мітка everKnown — на слові хоч раз натиснули Know (розблоковує конструкції).

// Після стількох нових слів повертається одне слово з черги "Again"
const REPEAT_EVERY = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

// "call|noun" і "call|verb" — це різні слова
const wordKey = (w) => `${w.en}|${w.type || ''}`;

const newState = () => ({ version: 2, words: {}, newSinceRepeat: 0 });

// Скільки слово ховається після першого Know (у тестовому режимі — секунди замість днів)
function reviewDelayMs(config) {
  return config.testMode ? config.testReviewSeconds * 1000 : config.reviewDays * DAY_MS;
}

// Конструкція (phrase) доступна, лише коли на дієслові з її base був Know.
// Якщо такого дієслова у списку немає — не блокуємо, щоб слово не загубилося назавжди.
function isUnlocked(word, words, state) {
  if (word.type !== 'phrase') return true;
  const base = words.find((w) => w.en === word.base && w.type === 'verb');
  if (!base) return true;
  const entry = state.words[wordKey(base)];
  return Boolean(entry && entry.everKnown);
}

// Обирає слово для показу. Повертає { word, kind } або null, якщо показувати нічого.
// kind: 'review' | 'again' | 'new' (kind потрібен для підпису в тестовому режимі)
function pickWord(state, words, now, lastWord = null) {
  const entryOf = (w) => state.words[wordKey(w)];
  const available = words.filter((w) => isUnlocked(w, words, state));

  // 1. Слова, в яких минув тиждень, — раніше за все інше
  const due = available
    .filter((w) => {
      const e = entryOf(w);
      return e && e.status === 'waiting' && e.dueAt <= now;
    })
    .sort((a, b) => entryOf(a).dueAt - entryOf(b).dueAt);
  if (due.length) return { word: due[0], kind: 'review' };

  const again = available
    .filter((w) => entryOf(w) && entryOf(w).status === 'again')
    .sort((a, b) => entryOf(a).since - entryOf(b).since);
  const fresh = available.filter((w) => !entryOf(w));

  // 2. Після 5 нових слів — одне слово з черги повторів
  if (again.length && state.newSinceRepeat >= REPEAT_EVERY) {
    state.newSinceRepeat = 0;
    return { word: again[0], kind: 'again' };
  }

  // 3. Нове слово
  if (fresh.length) {
    const pool = fresh.length > 1 ? fresh.filter((w) => w !== lastWord) : fresh;
    state.newSinceRepeat += 1;
    return { word: pool[Math.floor(Math.random() * pool.length)], kind: 'new' };
  }

  // 4. Нових немає (або конструкції ще заблоковані) — показуємо повтори
  if (again.length) {
    state.newSinceRepeat = 0;
    return { word: again[0], kind: 'again' };
  }

  // 5. Показувати нічого
  return null;
}

// Записує відповідь ('know' | 'again') на слово
function answer(state, word, kind, now, config) {
  const key = wordKey(word);
  const entry = state.words[key] || {};

  if (kind === 'know') {
    entry.everKnown = true;
    if (entry.status === 'waiting' && entry.dueAt <= now) {
      entry.status = 'learned'; // перевірка через тиждень пройдена
      delete entry.dueAt;
    } else {
      entry.status = 'waiting'; // перший Know (або Know після Again) — цикл спочатку
      entry.dueAt = now + reviewDelayMs(config);
    }
    delete entry.since;
  } else {
    entry.status = 'again'; // Again у будь-який момент — у чергу повторів
    entry.since = now;
    delete entry.dueAt;
  }

  state.words[key] = entry;
  return state;
}

// Розбирає вміст файлу прогресу. Старий формат (масиви known/again) не переносимо —
// повертаємо legacy: true, а викликаючий код відкладає старий файл і починає з чистого.
function parseProgress(raw) {
  if (raw && raw.version === 2 && raw.words && typeof raw.words === 'object') {
    return { state: { ...newState(), ...raw }, legacy: false };
  }
  return { state: newState(), legacy: true };
}

module.exports = { REPEAT_EVERY, wordKey, newState, reviewDelayMs, isUnlocked, pickWord, answer, parseProgress };
