const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

const learning = require('./learning');
const quizLogic = require('./quiz');

// config.json — бойові налаштування (потрапляють у збірку).
// config.local.json (необов'язковий, не потрапляє в git) перекриває окремі поля — для тестів.
const config = {
  ...readJson('config.json'),
  ...(fs.existsSync(path.join(__dirname, 'config.local.json')) ? readJson('config.local.json') : {}),
};

// Тестовий режим: окремі слова, окремий файл прогресу, швидкі інтервали
const testMode = Boolean(config.testMode);
const wordsFile = testMode && fs.existsSync(path.join(__dirname, 'words.test.json'))
  ? 'words.test.json'
  : 'words.json';
const words = readJson(wordsFile);
const intervalMs = testMode ? config.testIntervalMs : config.intervalMs;

// Тест (quiz): значення за замовчуванням у коді, щоб старий config.json без цих полів працював
const quizEnabled = config.quizEnabled !== false;
const quizTestIntervalMs = config.quizTestIntervalMs || 8000;
const quizEveryHours = config.quizEveryHours || 1; // один тест на стільки годин
const quizLearnedEvery =config.quizLearnedEvery || quizLogic.DEFAULT_LEARNED_EVERY;

let widget, moon, quizWin;
let timer = null;
let quizTimer = null;
let currentQuiz = null; // { word, answer, answered, id } — питання, яке зараз на екрані
let lastQuizWord = null;
let quizSeq = 0;
let dnd = false;
let lastWord = null;
let currentWord = null;
let progress = learning.newState();

const progressFile = () =>
  path.join(app.getPath('userData'), testMode ? 'progress.test.json' : 'progress.json');

function loadProgress() {
  let text;
  try {
    text = fs.readFileSync(progressFile(), 'utf8');
  } catch {
    return; // файлу ще немає — починаємо з нуля
  }
  let raw = null;
  try {
    raw = JSON.parse(text.replace(/^﻿/, '')); // BOM на початку файлу не заважає
  } catch {
    // пошкоджений файл — нижче його відкладемо, а не перезапишемо
  }
  const { state, legacy } = learning.parseProgress(raw);
  if (legacy) {
    // старий або пошкоджений формат: відкладаємо файл убік (не видаляємо) і стартуємо з чистого
    try {
      fs.renameSync(progressFile(), progressFile().replace(/\.json$/, '.old.json'));
    } catch (err) {
      console.error('Не вдалося відкласти старий прогрес:', err);
    }
  }
  progress = state;
}

function saveProgress() {
  try {
    fs.writeFileSync(progressFile(), JSON.stringify(progress, null, 2));
  } catch (err) {
    console.error('Не вдалося зберегти прогрес:', err);
  }
}

// Підпис для тестового режиму: що це за слово і де воно в циклі
const KIND_LABEL = { new: 'NEW', review: 'REVIEW (week passed)', again: 'AGAIN queue' };
function debugLabel(kind, word) {
  const parts = [KIND_LABEL[kind], word.type];
  return parts.join(' · ');
}

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(showWord, ms);
}

function showWord() {
  dnd = false;
  moon.webContents.send('dnd', false);
  const picked = learning.pickWord(progress, words, Date.now(), lastWord);
  saveProgress(); // pickWord міг змінити лічильник нових слів
  if (!picked) {
    // показувати нічого — перевіримо знову за інтервалом
    currentWord = null;
    schedule(intervalMs);
    return;
  }
  currentWord = picked.word;
  lastWord = picked.word;
  // підпис (NEW/REVIEW/AGAIN) — лише якщо явно ввімкнено в config.json
  const payload = testMode && config.showTestLabel
    ? { ...picked.word, debug: debugLabel(picked.kind, picked.word) }
    : picked.word;
  widget.webContents.send('show-word', payload);
  widget.showInactive();
}

function hideWidget() {
  widget.hide();
}

// ---- Тест (quiz): окреме вікно, раз на годину у випадковий момент ----

// Тестовий режим: тест кожні кілька секунд. Бойовий: по одному на календарну годину.
function scheduleQuiz(skipCurrentHour = false) {
  clearTimeout(quizTimer);
  if (!quizEnabled) return;
  const delay = testMode
    ? quizTestIntervalMs
    : Math.max(1000, quizLogic.nextQuizAt(Date.now(), Math.random, skipCurrentHour, quizEveryHours) - Date.now());
  quizTimer = setTimeout(showQuiz, delay);
}

function showQuiz() {
  scheduleQuiz(true); // наступний — уже в наступній годині
  // «Не турбувати» — цього разу тест пропускаємо. Вікно ще вантажиться — теж.
  if (dnd || !quizWin || quizWin.isDestroyed() || quizWin.webContents.isLoading()) return;

  const word = quizLogic.pickQuizWord(progress, words, Math.random, quizLearnedEvery, lastQuizWord);
  if (!word) return; // ще не показано жодного слова
  const q = quizLogic.buildQuiz(word, words);
  if (!q) return;

  lastQuizWord = word;
  // нове питання замінює старе, якщо на нього не відповіли
  currentQuiz = { word, answer: q.answer, answered: false, id: ++quizSeq };
  quizWin.webContents.send('show-quiz', { question: q.question, options: q.options });
  quizWin.showInactive();
}

function createWindows() {
  const { workArea } = screen.getPrimaryDisplay();

  widget = new BrowserWindow({
    width: 260,
    height: 170,
    x: workArea.x + workArea.width - 260 - 20,
    y: workArea.y + workArea.height - 170 - 84,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  widget.setAlwaysOnTop(true, 'screen-saver');
  widget.loadFile('index.html');

  // Вікно тесту стоїть ліворуч від віджета; ховається лише після відповіді
  quizWin = new BrowserWindow({
    width: QUIZ_WIDTH,
    height: QUIZ_INITIAL_HEIGHT,
    x: workArea.x + workArea.width - 260 - 20 - 10 - QUIZ_WIDTH,
    y: workArea.y + workArea.height - 84 - QUIZ_INITIAL_HEIGHT,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  quizWin.setAlwaysOnTop(true, 'screen-saver');
  quizWin.loadFile('quiz.html');

  moon = new BrowserWindow({
    width: 64,
    height: 64,
    x: workArea.x + workArea.width - 64 - 20,
    y: workArea.y + workArea.height - 64 - 10,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  moon.setAlwaysOnTop(true, 'screen-saver');
  moon.loadFile('moon.html');

  // Масштаб сторінки у віджеті й місяці завжди 100%: щоб випадковий зум (Ctrl + «+»/«-»)
  // не збільшував вміст, а після перезапуску не лишався збереженим.
  for (const win of [widget, moon, quizWin]) {
    const wc = win.webContents;
    wc.setVisualZoomLevelLimits(1, 1);
    wc.on('did-finish-load', () => wc.setZoomFactor(1));
    wc.on('before-input-event', (event, input) => {
      if ((input.control || input.meta) && ['+', '-', '=', '0'].includes(input.key)) {
        event.preventDefault();
      }
    });
  }
}

ipcMain.on('answered', (_e, kind) => {
  if (currentWord) {
    learning.answer(progress, currentWord, kind, Date.now(), config);
    saveProgress();
  }
  hideWidget();
  schedule(intervalMs);
});

// Віджет підганяється під висоту вмісту (не нижче базової і не вище за стелю).
// Нижній край лишається на місці, тож вікно росте вгору і не налізає на місяць.
const WIDGET_MIN_HEIGHT = 170;
const WIDGET_MAX_HEIGHT = 420;
ipcMain.on('fit', (_e, height) => {
  if (!widget || widget.isDestroyed() || !Number.isFinite(height)) return;
  const target = Math.min(Math.max(Math.ceil(height), WIDGET_MIN_HEIGHT), WIDGET_MAX_HEIGHT);
  const b = widget.getBounds();
  if (target === b.height) return;
  widget.setBounds({ x: b.x, y: b.y + b.height - target, width: b.width, height: target });
});

// Вікно тесту так само підганяється під вміст, нижній край лишається на місці
const QUIZ_WIDTH = 280;
const QUIZ_INITIAL_HEIGHT = 320;
const QUIZ_MIN_HEIGHT = 260;
const QUIZ_MAX_HEIGHT = 420;
ipcMain.on('quiz-fit', (_e, height) => {
  if (!quizWin || quizWin.isDestroyed() || !Number.isFinite(height)) return;
  const target = Math.min(Math.max(Math.ceil(height), QUIZ_MIN_HEIGHT), QUIZ_MAX_HEIGHT);
  const b = quizWin.getBounds();
  if (target === b.height) return;
  quizWin.setBounds({ x: b.x, y: b.y + b.height - target, width: b.width, height: target });
});

// Відповідь на тест. Правильна — нічого не змінює; помилка — слово йде в чергу повторів (Again).
const QUIZ_RESULT_MS = 2000;
ipcMain.on('quiz-answer', (_e, chosen) => {
  const q = currentQuiz;
  if (!q || q.answered) return;
  q.answered = true;
  if (chosen !== q.answer) {
    learning.answer(progress, q.word, 'again', Date.now(), config);
    saveProgress();
  }
  quizWin.webContents.send('quiz-result', { chosen, correct: q.answer });
  // ховаємо через 2 секунди, якщо за цей час не прийшло нове питання
  setTimeout(() => {
    if (currentQuiz && currentQuiz.id === q.id && quizWin && !quizWin.isDestroyed()) quizWin.hide();
  }, QUIZ_RESULT_MS);
});

// перетягування місяця: запам'ятовуємо стартову позицію і зміщуємо на dx, dy
let moonStart = [0, 0];
ipcMain.on('moon-drag-start', () => {
  moonStart = moon.getPosition();
});
ipcMain.on('moon-drag-move', (_e, dx, dy) => {
  moon.setBounds({
    x: Math.round(moonStart[0] + dx),
    y: Math.round(moonStart[1] + dy),
    width: 64,
    height: 64,
  });
});

ipcMain.on('moon-click', () => {
  if (dnd) {
    // повторний клік — вимкнути "не турбувати"; слово прийде за звичайним графіком
    dnd = false;
    moon.webContents.send('dnd', false);
    schedule(intervalMs);
  } else {
    dnd = true;
    moon.webContents.send('dnd', true);
    hideWidget();
    schedule(config.dndMs);
  }
});

// друга копія апки не запускається — одразу виходить
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    // Автозапуск разом із Windows — лише для зібраної версії (English.exe), не для розробки
    // і не в тестовому режимі. Вимкнути: "autostart": false у config.json і один раз запустити.
    // Сон ноутбука окремо не обробляємо: апка засинає разом із ним і продовжує після пробудження.
    if (app.isPackaged && !testMode) {
      // власна назва запису в реєстрі, щоб не збігатися з іншими Electron-програмами
      app.setLoginItemSettings({ openAtLogin: config.autostart !== false, name: 'DadEnglish' });
    }

    loadProgress();
    createWindows();
    widget.webContents.once('did-finish-load', showWord);
    scheduleQuiz();
  });
}

app.on('window-all-closed', () => app.quit());
