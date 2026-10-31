<p align="center">
  <img src="docs/widget.jpg" alt="English widget: a small always-on-top window showing a word with Know and Again buttons" width="420">
</p>

# English

**English** is a tiny always-on-top desktop widget that teaches vocabulary one word at a time. It was built for a beginner (A0) who works in IT: a word pops up every 50 minutes, you tap *Know* or *Again*, and it gets out of the way.
Words come back on a **spaced-repetition** schedule (a check after 7 days), and phrasal verbs unlock only after you know their base verb.
A moon button gives you "do not disturb" in one click. Runs on **Windows** and **Mac**, fully **offline**: no account, no internet connection needed.

<p align="center">
  <a href="https://github.com/aiiadu-ai/dad-english/releases/latest">
    <img src="https://img.shields.io/badge/Download-latest%20release-2ea44f?style=for-the-badge" alt="Download the latest release">
  </a>
</p>

---

## How it's built

**Stack.** [Electron](https://www.electronjs.org/) 33 with plain JavaScript, HTML and CSS, no frameworks:
a widget with 200 words doesn't need them. Tests use Node's built-in runner (`node --test`). The apps are
packaged with [electron-builder](https://www.electron.build/) and built automatically by GitHub Actions.

**Spaced repetition.** A word goes through a simple cycle:
`new` → Know → `waits 7 days` → review → Know → `learned for good`. Again at any step
sends the word to a repeat queue and the cycle starts over. Scheduling rules:
- words whose week has passed are shown before new ones;
- a word from the repeat queue comes back after every 5 new words;
- phrases (`go on`, `come back`) unlock only after Know on their base verb (`go`, `come`),
  a "base first, derived second" dependency.

All of this logic lives in a separate module, `learning.js`, which doesn't depend on Electron, so it can be
checked with fast automated tests (`npm test`, 13 tests) without opening any windows.

**Reliability in the details.** Progress is saved after every answer; a corrupted or old progress file is never
overwritten, it is set aside instead; a second copy of the app can't be started; the app launches together with
the computer; test settings live in a separate file that doesn't end up in the build.

**GitHub Actions builds for Mac and Windows.** A Mac app can't be built on Windows, so GitHub does it all:
one workflow ([`build.yml`](.github/workflows/build.yml)) builds a universal `.dmg` (Intel + Apple Silicon)
on `macos-latest` and a `.zip` for Windows on `windows-latest` for every version, runs the tests before building,
and on a `v*` tag publishes both files on the [Releases](https://github.com/aiiadu-ai/dad-english/releases) page.

**Made with Claude Code.** The author is not a programmer and is learning vibe coding: the project was built
in pair with [Claude Code](https://claude.com/claude-code), Anthropic's AI coding assistant.
The author set the requirements, made the decisions and checked the results; Claude Code wrote the code,
the tests and the build setup.

---

## Як це працює

1. Раз на 50 хвилин з'являється **англійське слово**.
2. Клік по слову показує **український переклад** (ще клік — повертає англійське).
3. Кнопки **Know** (знаю) і **Again** (ще раз). Після кліку віджет ховається до наступного слова.
4. **Know** → слово ховається на **7 днів**. Через тиждень воно повертається на перевірку:
   - **Know** ще раз → слово вивчене назавжди;
   - **Again** → слово йде в чергу повторів, і все починається спочатку.
5. **Again** у будь-який момент → слово повертається після кожних 5 нових слів.
   Слова, в яких минув тиждень, показуються раніше за нові.
6. **Конструкції** (`go on`, `come back`, `make sure`…) з'являються лише після того, як на їхньому
   базовому дієслові (`go`, `come`, `make`) хоч раз натиснули Know.
7. Іконка 🌙 внизу завжди на екрані: клік вмикає **«не турбувати»** (слова не з'являються 2 години),
   ще клік — вимикає. Іконку можна перетягнути в зручне місце.

Програма відкривається сама разом із комп'ютером (автозапуск), а прогрес зберігається у файлі й не губиться.

### Коли з'являється наступне слово

Часи нижче — за замовчуванням, їх можна змінити в `config.json` (`intervalMs`, `dndMs`).

| Що сталося | Коли буде наступне слово |
|---|---|
| Програму щойно запустили (або ввімкнули комп'ютер, якщо працює автозапуск) | **одразу**: одне слово показується при старті |
| Натиснули **Know** або **Again** | через **50 хвилин** |
| Клікнули 🌙, щоб увімкнути «не турбувати» | слово ховається, наступне прийде **само рівно через 2 години** після кліку |
| Клікнули 🌙 ще раз, щоб вимкнути «не турбувати» | через **50 хвилин** після цього кліку, а не одразу |
| Клікнули 🌙, поки слово ще на екрані | слово ховається без відповіді (ні Know, ні Again), далі як у «не турбувати» |
| Усі слова вивчені або чекають перевірки | нічого не з'являється; програма перевіряє знову кожні 50 хвилин, і слово повернеться, коли мине 7 днів |

Поки комп'ютер вимкнений, слова не з'являються.

### Чи потрібен інтернет

**Ні, програма працює повністю без інтернету.** Усі слова, переклади й прогрес лежать на самому
комп'ютері (`words.json` і `progress.json`), а в коді програми немає жодних звернень до мережі:
вона нічого нікуди не надсилає й не потребує облікового запису. Інтернет потрібен лише один раз, щоб
завантажити файл програми зі сторінки Releases, а далі його можна вимкнути.

## Завантажити

Готові програми лежать на сторінці **[Releases](https://github.com/aiiadu-ai/dad-english/releases/latest)**.
Відкрий найновіший реліз і завантаж файл для своєї системи:

| Система | Файл |
|---|---|
| Windows 10/11 | `English-…-win-x64.zip` |
| Mac (Intel і Apple Silicon) | `English-…-universal.dmg` |

Програми не підписані, тому система при першому запуску попросить підтвердження — нижче описано, як.

## Встановлення на Windows

1. Завантаж `English-…-win-x64.zip`.
2. Клацни на ньому правою кнопкою → **«Видобути все»** (Extract all) у **постійну папку**
   (наприклад, `C:\Programs\English` або на робочий стіл). Не запускай прямо з архіву й не переноси
   папку потім: автозапуск запам'ятовує, де лежить програма.
3. Відкрий папку й двічі клікни **`English.exe`**.
4. Якщо Windows пише **«Windows protected your PC»**: натисни **«Докладніше»** → **«Все одно виконати»**.

Після першого запуску програма відкриватиметься сама разом із Windows. Вимкнути це можна, змінивши
`"autostart": true` на `false` у файлі `resources\app\config.json` і один раз запустивши програму.

## Встановлення на Mac

Для Mac. Програма не підписана Apple, тому macOS попросить дозволу при першому запуску.

1. Завантаж `English-….dmg` і відкрий його.
2. Перетягни **English** у папку **Applications** (Програми).
3. Відкрий English з Applications. macOS скаже, що не може перевірити програму, — натисни **«Готово»**.
4. Відкрий **Системні налаштування → Конфіденційність і безпека**, прокрути вниз до повідомлення про
   English і натисни **«Все одно відкрити»**. Підтверди паролем Mac.
5. Далі програма запускатиметься без запитань.

Автозапуск разом із Mac закладений у програмі, але на справжньому Mac його ще не перевіряли.

**Якщо macOS пише, що програма «пошкоджена»** — відкрий Термінал і виконай:

```bash
xattr -cr /Applications/English.app
```

Після цього відкрий English ще раз.

## Запуск локально (для розробки)

Потрібен [Node.js](https://nodejs.org/) 20 або новіший.

```bash
npm install
npm start
```

На Windows у PowerShell команду `npm` може заблокувати політика скриптів — тоді використовуй
`npm.cmd start`.

Перевірка логіки вивчення:

```bash
npm test
```

### Тестовий режим

Щоб не чекати 50 хвилин і 7 днів, створи файл `config.local.json` (він не потрапляє в git):

```json
{ "testMode": true }
```

У тестовому режимі беруться слова з `words.test.json` (12 слів), слово з'являється кожні 5 секунд,
а «тиждень» триває 40 секунд. Прогрес тестового режиму пишеться в окремий `progress.test.json`.
Щоб побачити на віджеті підпис (NEW / REVIEW / AGAIN), додай `"showTestLabel": true`.

## Налаштування (`config.json`)

| Поле | Що означає | За замовчуванням |
|---|---|---|
| `intervalMs` | пауза між словами, мілісекунди | `3000000` (50 хв) |
| `dndMs` | скільки триває «не турбувати» | `7200000` (2 год) |
| `reviewDays` | через скільки днів перевірка після першого Know | `7` |
| `autostart` | відкривати апку разом із комп'ютером | `true` |
| `testMode` | тестовий режим (див. вище) | `false` |
| `testIntervalMs`, `testReviewSeconds` | швидкі інтервали тестового режиму | `5000`, `40` |

`config.local.json` перекриває окремі поля `config.json`.

## Як додати слова (`words.json`)

Файл — це масив слів. Приклад:

```json
[
  {
    "en": "deadline",
    "uk": "дедлайн, кінцевий термін",
    "type": "noun",
    "examples": [{ "en": "The deadline is Friday.", "uk": "Дедлайн — у п'ятницю." }]
  },
  {
    "en": "go on",
    "uk": "продовжувати",
    "type": "phrase",
    "base": "go",
    "examples": [{ "en": "Please, go on.", "uk": "Продовжуйте, будь ласка." }]
  }
]
```

- `en` — слово англійською, `uk` — переклад.
- `type` — `noun` (іменник), `verb` (дієслово) або `phrase` (конструкція).
- `base` — **лише для `phrase`**: дієслово, після Know на якому відкриється конструкція
  (наприклад, для `go on` це `go`). Таке дієслово (`type: "verb"`) має бути в списку.
- `examples` — приклади речень (поки не показуються, це наступний етап).
- Пара `en` + `type` має бути унікальною (`call` як іменник і `call` як дієслово — це різні слова).

Після зміни слів запусти `npm test`. У вже встановленій програмі `words.json` лежить:
- Windows: `resources\app\words.json` у папці програми;
- Mac: `English.app` → правою кнопкою «Показати вміст пакета» → `Contents/Resources/app/words.json`.

## Де зберігається прогрес

- Windows: `%APPDATA%\dad-english\progress.json`
- Mac: `~/Library/Application Support/dad-english/progress.json`

Щоб почати вивчення спочатку, закрий програму й видали цей файл.

## Як випустити нову версію

Збірки робить GitHub Actions (файл `.github/workflows/build.yml`), бо Mac-програму на Windows не зібрати.

- **Перевірка без публікації:** вкладка **Actions** → **Build** → **Run workflow**. Обидві збірки
  з'являться внизу запуску в розділі **Artifacts**.
- **Публікація:** змінити `"version"` у `package.json`, закомітити, створити тег виду `v1.0.1`
  й запушити його. Збірка запуститься сама, а за кілька хвилин на сторінці Releases з'являться обидва файли.

## Структура проєкту

| Файл | Призначення |
|---|---|
| `main.js` | вікна, таймери, збереження прогресу |
| `learning.js` | уся логіка вибору слів (тестується окремо) |
| `learning.test.js` | автотести логіки |
| `index.html`, `style.css`, `renderer.js`, `preload.js` | віджет зі словом |
| `moon.html` | іконка 🌙 |
| `words.json` | 200 слів |
| `words.test.json` | 12 слів для тестового режиму |
| `.github/workflows/build.yml` | автоматична збірка для Windows і Mac |
| `docs/widget.jpg` | скріншот віджета для README |
