const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onShowWord: (cb) => ipcRenderer.on('show-word', (_e, word) => cb(word)),
  onDnd: (cb) => ipcRenderer.on('dnd', (_e, on) => cb(on)),
  answer: (kind) => ipcRenderer.send('answered', kind),
  moonClick: () => ipcRenderer.send('moon-click'),
  moonDragStart: () => ipcRenderer.send('moon-drag-start'),
  moonDragMove: (dx, dy) => ipcRenderer.send('moon-drag-move', dx, dy),
});
