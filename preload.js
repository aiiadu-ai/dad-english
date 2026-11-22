const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onShowWord: (cb) => ipcRenderer.on('show-word', (_e, word) => cb(word)),
  onDnd: (cb) => ipcRenderer.on('dnd', (_e, on) => cb(on)),
  answer: (kind) => ipcRenderer.send('answered', kind),
  fit: (height) => ipcRenderer.send('fit', height),
  moonClick: () => ipcRenderer.send('moon-click'),
  moonDragStart: () => ipcRenderer.send('moon-drag-start'),
  moonDragMove: (dx, dy) => ipcRenderer.send('moon-drag-move', dx, dy),
  // вікно тесту
  onShowQuiz: (cb) => ipcRenderer.on('show-quiz', (_e, quiz) => cb(quiz)),
  onQuizResult: (cb) => ipcRenderer.on('quiz-result', (_e, result) => cb(result)),
  quizAnswer: (choice) => ipcRenderer.send('quiz-answer', choice),
  quizFit: (height) => ipcRenderer.send('quiz-fit', height),
});
