const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

const learning = require('./learning');

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

let widget, moon;
let timer = null;
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
}

ipcMain.on('answered', (_e, kind) => {
  if (currentWord) {
    learning.answer(progress, currentWord, kind, Date.now(), config);
    saveProgress();
  }
  hideWidget();
  schedule(intervalMs);
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
  });
}

app.on('window-all-closed', () => app.quit());
