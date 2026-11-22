const questionEl = document.getElementById('question');
const hintEl = document.getElementById('qhint');
const optionsEl = document.getElementById('options');

let answered = false;

// Підганяє висоту вікна під вміст — так само, як у віджеті зі словом (див. renderer.js)
function fit() {
  const body = document.body;
  const prev = body.style.height;
  body.style.height = 'auto';
  const needed = Math.ceil(body.getBoundingClientRect().height);
  body.style.height = prev;
  window.api.quizFit(needed + 8);
}

window.api.onShowQuiz((quiz) => {
  answered = false;
  questionEl.textContent = quiz.question;
  questionEl.style.fontSize = quiz.question.length > 22 ? '18px' : quiz.question.length > 12 ? '22px' : '28px';
  hintEl.textContent = 'choose the translation';
  hintEl.className = 'hint';
  optionsEl.textContent = '';
  for (const text of quiz.options) {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.textContent = text;
    btn.addEventListener('click', () => {
      if (answered) return; // друга відповідь на те саме питання не рахується
      answered = true;
      window.api.quizAnswer(text);
    });
    optionsEl.appendChild(btn);
  }
  fit();
});

// main.js повідомляє, чи правильно: підсвічуємо відповідь і правильний варіант
window.api.onQuizResult(({ chosen, correct }) => {
  for (const btn of optionsEl.children) {
    btn.disabled = true;
    if (btn.textContent === correct) btn.classList.add('ok');
    else if (btn.textContent === chosen) btn.classList.add('bad');
  }
  const right = chosen === correct;
  hintEl.textContent = right ? 'Correct!' : 'Not quite — it will come back';
  hintEl.className = right ? 'hint good' : 'hint wrong';
  fit();
});

fit();
