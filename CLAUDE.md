# dad-english

Десктоп-апка на Electron для вивчення англійської (рівень A0, IT-CEO). Маленький віджет
поверх усіх вікон показує слово, є кнопки Know / Again і місяць 🌙 («не турбувати»).
Власник проєкту не програміст: пояснювати простими словами, питати перед великими рішеннями.

## Файли
- `main.js` — вікна, таймери, IPC, збереження прогресу
- `learning.js` — вся логіка вибору слів (без Electron, тестується окремо)
- `learning.test.js` — тести логіки (`node --test`)
- `preload.js`, `renderer.js`, `index.html`, `style.css` — віджет зі словом
- `moon.html` — окреме вікно з місяцем (клік = «не турбувати», можна перетягувати)
- `words.json` — 200 слів (`en`, `uk`, `type`: noun/verb/phrase, у phrase ще `base`, `examples`)
- `words.test.json` — 12 слів для тестового режиму
- `config.json` — бойові налаштування, потрапляють у збірку (див. нижче)
- `config.local.json` — локальні перекриття для тестів, **не в git** (див. нижче)
- `README.md` — опис для людей (українською); `.github/workflows/build-mac.yml` — збірка .dmg

## Запуск
- Розробка: `npm.cmd start` (у PowerShell `npm start` блокується політикою скриптів).
- Перед перезапуском закрити стару копію; друга копія не запускається (single instance lock).
- Тести логіки: `npm test` (= `node --test`)

## Конфіг (`config.json`)
`config.json` — **бойовий** (його бере збірка). `main.js` зливає його з необов'язковим
`config.local.json`, який перекриває окремі поля й не потрапляє в git (`.gitignore`).
Для тестів у `config.local.json` лежить `{ "testMode": true }`.

- `intervalMs` — пауза між словами (3000000 = 50 хв)
- `dndMs` — скільки триває «не турбувати» (2 год)
- `reviewDays` — через скільки днів перевіряємо слово після першого Know (7)
- `autostart` — `true`: зібрана версія (`English.exe`) сама відкривається при вході в Windows
  (див. «Сон, вимкнення, автозапуск»). `false` вимикає.
- `testMode` — `true`: слова з `words.test.json`, окремий файл прогресу, швидкі інтервали:
  `testIntervalMs` (мс між словами) і `testReviewSeconds` (секунди замість `reviewDays`).
  `showTestLabel` — `true` показує на віджеті жовтий підпис (NEW / REVIEW / AGAIN) для
  відладки; за замовчуванням `false` (користувач не має бачити чергу й логіку).
  `testMode` вмикати лише в `config.local.json`, у `config.json` він має бути `false`.

## Логіка вивчення
Стан кожного слова зберігається у `progress.json` (`%APPDATA%\dad-english\`, у тестовому
режимі — `progress.test.json`). Ключ слова — `en|type` (`call|noun` і `call|verb` різні).

| Стан | Значення |
|---|---|
| немає запису | нове слово |
| `waiting` | отримало Know, ховається до `dueAt` |
| `again` | у черзі повторів |
| `learned` | вивчене назавжди |

Ще є мітка `everKnown`: на слові хоч раз був Know. Вона не скидається.

**Відповіді**
- Know на новому слові або на слові з черги повторів → `waiting`, ховається на `reviewDays`.
- Know на слові, в якого минув тиждень → `learned` (назавжди).
- Again у будь-який момент → `again` (черга повторів), цикл з нуля. Know після Again знову
  рахується першим Know (ще тиждень).

**Що показувати (по черзі)**
1. Слова, в яких минув тиждень (раніше за все, найстаріші першими).
2. Слово з черги повторів, якщо від останнього повтору показано 5 нових (`REPEAT_EVERY`).
3. Нове слово (випадкове, не те саме, що щойно було).
4. Нових немає (або конструкції заблоковані) → слова з черги повторів.
5. Нічого немає → віджет мовчить, перевірка знову через `intervalMs`.

**Конструкції (`type: "phrase"`)** не показуються, поки на дієслові з поля `base` не було
хоч одного Know (`everKnown`). Приклад: `go on` з'являється після Know на `go`. Розблокування
не скасовується, якщо дієслово потім потрапило в Again. Якщо `base` не знайдено серед дієслів —
конструкція не блокується.

**Старий прогрес.** Файл прогресу старого формату (без `version: 2`) або пошкоджений не
переноситься й не перезаписується: його відкладають як `progress.old.json`, апка стартує з нуля.

## Сон, вимкнення, автозапуск
- **Сон ноутбука:** окремо не обробляємо. Апка засинає разом із ним і продовжує після
  пробудження (таймери йдуть далі). Не перевірялося на справжньому сні.
- **Вимкнення комп'ютера:** Windows сама закриває апку; прогрес уже збережений після кожної
  відповіді.
- **Автозапуск:** `main.js` викликає `app.setLoginItemSettings({ openAtLogin })` при кожному
  старті, але лише коли `app.isPackaged` (запуск `English.exe`, а не `npm start`) і
  `testMode: false`. Тому розробка й тести нічого не реєструють у системі. Запис живе в
  реєстрі користувача (`HKCU\...\CurrentVersion\Run`) і оновлюється шляхом до `English.exe`,
  тож після переносу папки достатньо один раз запустити з нового місця.
  Вимкнути: `"autostart": false` у `resources\app\config.json` і один раз запустити апку.

## Портативна збірка для іншого ноутбука
Без npm і Node.js. Папка = копія `node_modules\electron\dist` + код у `resources\app`
(`main.js`, `learning.js`, `preload.js`, `renderer.js`, `index.html`, `style.css`, `moon.html`,
`words.json`, `config.json`, `package.json`), `electron.exe` перейменований в `English.exe`,
поруч `start.bat` (`start "" "%~dp0English.exe"`). Потім папка пакується в zip.
`words.test.json` і `config.local.json` у збірку не потрапляють; `config.json` береться як є
(він бойовий). Раніше збудований zip мав свій копіюваний конфіг — тепер це зайве.

## Збірка для Mac і GitHub
- Репозиторій: https://github.com/aiiadu-ai/dad-english, гілка `main`.
- Mac-програми не збираються на Windows, тому .dmg збирає GitHub Actions
  (`.github/workflows/build-mac.yml`): запуск вручну (workflow_dispatch) і на теги `v*`;
  `macos-latest`, Node 20, `npm ci` → `npm test` → `npm run dist:mac` → artifact `English-mac-dmg`.
  `CSC_IDENTITY_AUTO_DISCOVERY=false` — без сертифіката Apple.
- Налаштування збірки — у `package.json`, поле `build` (electron-builder 26): `appId`
  `com.aiiadu.english`, `productName` `English`, universal dmg (Intel + Apple Silicon),
  `asar: false` (слова й конфіг лишаються відкритими), `files` — білий список файлів.
- `dist:mac` має `--publish never`: на CI електрон-білдер сам намагається публікувати на GitHub
  і падає без `GH_TOKEN` (перший запуск Action упав саме на цьому, хоча .dmg уже був зібраний).
- `productName` свідомо **не** виставлений угорі `package.json`: інакше Electron змінить назву
  папки з прогресом (`dad-english` → `English`).
- Без підпису Apple на Apple Silicon macOS може писати «пошкоджена» — лікується
  `xattr -cr /Applications/English.app` (описано в README).
- Збірку для Mac на Windows перевірити неможливо: локально перевірені `npm ci` і прийняття
  конфігу електрон-білдером; справжній результат дасть перший запуск Action.
- Lock-файл після зміни залежностей оновлювати так: `npm.cmd install --package-lock-only`
  (локальний npm 11 блокує install-скрипти, ця команда нічого не встановлює).

## Відомі підводні камені (Windows)
- Electron іноді не розпаковується після `npm install` (Node 26): архів лежить у
  `%LOCALAPPDATA%\electron\Cache`, його можна розпакувати вручну в `node_modules\electron\dist`
  і створити `node_modules\electron\path.txt` з текстом `electron.exe`.
- Прогрес і слова на кожному пристрої окремі; прогрес не переноситься разом із програмою.
