const wordEl = document.getElementById('word');
const hintEl = document.getElementById('hint');

let current = null;
let showingTranslation = false;

// Підганяє висоту вікна під вміст: якщо вміст став вищим (збільшений шрифт чи масштаб,
// довга фраза), вікно підростає, а не показує смугу прокрутки з обрізаними кнопками.
function fit() {
  const body = document.body;
  const prev = body.style.height;
  body.style.height = 'auto'; // природна висота вмісту без центрування у вікні
  const needed = Math.ceil(body.getBoundingClientRect().height);
  body.style.height = prev;
  window.api.fit(needed + 8);
}

// довгі слова й фрази (pay attention to) трохи зменшуємо, щоб влізли у віджет
function setText(text) {
  wordEl.textContent = text;
  wordEl.style.fontSize = text.length > 22 ? '18px' : text.length > 12 ? '22px' : '30px';
  fit();
}

window.api.onShowWord((word) => {
  current = word;
  showingTranslation = false;
  setText(word.en);
  hintEl.textContent = 'click the word';
  document.getElementById('debug').textContent = word.debug || '';
  fit();
});

wordEl.addEventListener('click', () => {
  if (!current) return;
  showingTranslation = !showingTranslation;
  setText(showingTranslation ? current.uk : current.en);
  hintEl.textContent = showingTranslation ? current.en : 'click the word';
  fit();
});

document.getElementById('know').addEventListener('click', () => window.api.answer('know'));
document.getElementById('again').addEventListener('click', () => window.api.answer('again'));

fit();
