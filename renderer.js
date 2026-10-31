const wordEl = document.getElementById('word');
const hintEl = document.getElementById('hint');

let current = null;
let showingTranslation = false;

// довгі слова й фрази (pay attention to) трохи зменшуємо, щоб влізли у віджет
function setText(text) {
  wordEl.textContent = text;
  wordEl.style.fontSize = text.length > 22 ? '18px' : text.length > 12 ? '22px' : '30px';
}

window.api.onShowWord((word) => {
  current = word;
  showingTranslation = false;
  setText(word.en);
  hintEl.textContent = 'click the word';
  document.getElementById('debug').textContent = word.debug || '';
});

wordEl.addEventListener('click', () => {
  if (!current) return;
  showingTranslation = !showingTranslation;
  setText(showingTranslation ? current.uk : current.en);
  hintEl.textContent = showingTranslation ? current.en : 'click the word';
});

document.getElementById('know').addEventListener('click', () => window.api.answer('know'));
document.getElementById('again').addEventListener('click', () => window.api.answer('again'));
