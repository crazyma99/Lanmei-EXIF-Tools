const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const net = require('net');
const fs = require('fs');

let mainWindow;
let apiProcess;
let apiPort;
let apiPid; // Store PID specifically

const isDev = !app.isPackaged;

function findFreePort(start, end) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    let port = start;

    function tryPort(p) {
      if (p > end) {
        reject(new Error('No free ports found'));
        return;
      }
      server.listen(p, '127.0.0.1');
      server.on('listening', () => {
        server.close(() => resolve(p));
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(p + 1);
        } else {
          reject(err);
        }
      });
    }

    tryPort(port);
  });
}

function startPythonBackend(port) {
  let script = path.join(process.resourcesPath, 'api.exe');
  if (isDev) {
    script = path.join(__dirname, '../backend_dist/api.exe');
  }

  if (!fs.existsSync(script)) {
    console.error('API executable not found at:', script);
    return;
  }

  const userDataPath = app.getPath('userData');
  console.log('Starting Python backend:', script, 'on port', port);
  console.log('Data directory:', userDataPath);

  // Hide the console window for the subprocess on Windows
  // const subprocessOptions = process.platform === 'win32' ? { windowsHide: true } : {};
  
  apiProcess = spawn(script, ['--port', port.toString(), '--data-dir', userDataPath], {
    windowsHide: true // This might hide the console window
  });
  
  if (apiProcess) {
    apiPid = apiProcess.pid;
    console.log('Python backend started with PID:', apiPid);
  }

  apiProcess.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
  });

  apiProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  apiProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

async function createWindow() {
  try {
    apiPort = await findFreePort(15000, 25000);
  } catch (e) {
    console.error('Failed to find free port:', e);
    apiPort = 5000; // Fallback
  }

  startPythonBackend(apiPort);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../frontend/app/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false 
    },
  });

  const indexPath = path.join(__dirname, '../frontend/out/index.html');
  mainWindow.loadFile(indexPath);
  
  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('get-api-port-sync', (event) => {
    event.returnValue = apiPort;
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Kill the Python process forcefully
  if (apiProcess) {
    console.log('Killing Python process...');
    
    // Try graceful kill first
    apiProcess.kill();
    
    // On Windows, sometimes child processes don't die easily, especially if they spawned grandchildren.
    // We can use taskkill to be sure.
    if (process.platform === 'win32' && apiPid) {
      try {
        exec(`taskkill /F /T /PID ${apiPid}`, (error, stdout, stderr) => {
          if (error) {
            console.log(`taskkill error: ${error}`);
          }
          console.log('taskkill stdout:', stdout);
        });
      } catch (e) {
        console.error('Failed to taskkill:', e);
      }
    }
    
    apiProcess = null;
  }
});
