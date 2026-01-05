const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('env', {
  get API_BASE() {
    try {
        const port = ipcRenderer.sendSync('get-api-port-sync');
        return `http://127.0.0.1:${port}`;
    } catch (e) {
        console.error('Failed to get API port:', e);
        return 'http://localhost:5000';
    }
  }
});
