// ============================================================
//  蓝色大肥鱼 DeepSeek Harness 懒人客户端 - 桌面客户端主进程
//  位置：resources\app\main.js（客户端根目录 = 本文件的上上级）
//  ------------------------------------------------------------
//  功能：
//   - 无边框独立窗口（frame:false + titleBarOverlay 系统按钮）
//   - 自动启动/管理 DSH 服务（隐藏进程，日志 data\server.log）
//   - 首次使用引导输入 API Key（写入 .credentials.yaml）
//   - 关闭窗口 = 停止服务并退出
// ============================================================
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ---------------- 路径 ----------------
const ROOT = path.dirname(path.dirname(app.getAppPath())); // 客户端根目录（resources 的上一级）
const APP_DIR = path.join(ROOT, 'app');               // dsh 依赖
const DSH_BIN = path.join(APP_DIR, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.join(DATA_DIR, 'server.log');
const HOME_DIR = process.env.DSH_HOME ||
    path.join(app.getPath('home'), '.dsh');
const CRED_FILE = path.join(HOME_DIR, '.credentials.yaml');
const WORKSPACE = path.join(app.getPath('home'), 'DeepSeek-Harness-Workspace');

// ---------------- 状态 ----------------
let mainWin = null;
let serverProc = null;
let port = 3080;
let baseURL = null;
let uiUrl = null;

// ---------------- 配置 ----------------
function stripBom(s) { return s.replace(/^\uFEFF/, ''); }

function readConfig() {
  try {
    const cfg = JSON.parse(stripBom(fs.readFileSync(CONFIG_FILE, 'utf8')));
    if (typeof cfg.port === 'number') port = cfg.port;
    if (typeof cfg.baseURL === 'string' && cfg.baseURL) baseURL = cfg.baseURL;
  } catch (e) { /* 默认 3080 */ }
}

function saveConfig() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const cfg = { port, baseURL: baseURL || null, configured: true };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) { }
}

// ---------------- Node 解析 ----------------
function findNode() {
  const tools = path.join(ROOT, 'tools', 'node', 'node.exe');
  if (fs.existsSync(tools)) return tools;
  const pf = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe');
  if (fs.existsSync(pf)) return pf;
  return 'node'; // 最后手段：PATH
}

// ---------------- API Key ----------------
function hasKey() {
  try {
    if (!fs.existsSync(CRED_FILE)) return false;
    return stripBom(fs.readFileSync(CRED_FILE, 'utf8'))
      .split(/\r?\n/)
      .some(l => /^\s*DEEPSEEK_API_KEY\s*:\s*\S/.test(l));
  } catch (e) { return false; }
}

function writeKey(key) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  let lines = [];
  if (fs.existsSync(CRED_FILE)) {
    lines = stripBom(fs.readFileSync(CRED_FILE, 'utf8')).split(/\r?\n/);
  }
  const rendered = 'DEEPSEEK_API_KEY: ' + key;
  let hit = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*DEEPSEEK_API_KEY\s*:/.test(lines[i])) { hit = i; break; }
  }
  if (hit >= 0) lines[hit] = rendered; else lines.push(rendered);
  fs.writeFileSync(CRED_FILE, lines.join('\r\n'));
}

// ---------------- 服务 ----------------
function portIsDsh(p) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: p, path: '/', timeout: 1500 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; if (body.length > 100000) req.destroy(); });
      res.on('end', () => resolve(res.statusCode === 200 && body.indexOf('DeepSeek Harness') >= 0));
      res.on('error', () => resolve(false));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function portBusy(p) {
  return new Promise((resolve) => {
    const sock = require('net').connect({ host: '127.0.0.1', port: p }, () => { sock.destroy(); resolve(true); });
    sock.on('error', () => resolve(false));
  });
}

async function findFreePort(start) {
  for (let p = start; p < start + 100; p++) {
    if (!(await portBusy(p))) return p;
  }
  return 0;
}

function logLine(line) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\r\n');
  } catch (e) { }
}

async function startServer() {
  if (await portIsDsh(port)) return { ok: true, reused: true };
  if (await portBusy(port)) {
    const free = await findFreePort(port);
    if (!free) return { ok: false, error: '端口 ' + port + ' 及后续 100 个端口均被占用' };
    port = free;
  }
  if (!fs.existsSync(DSH_BIN)) return { ok: false, error: '未安装 DeepSeek Harness，请先运行安装程序' };
  const nodeExe = findNode();

  try { fs.mkdirSync(WORKSPACE, { recursive: true }); } catch (e) { }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, '=== ' + new Date().toLocaleString() + ' 服务启动 ===\r\n');
  } catch (e) { }

  serverProc = spawn(nodeExe, [DSH_BIN, 'web', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: WORKSPACE,
    windowsHide: true,
    env: Object.assign({}, process.env, {
      DSH_HOME: HOME_DIR,
      DSH_TELEMETRY_DISABLED: '1',
      ...(baseURL ? { DEEPSEEK_BASE_URL: baseURL } : {}),
    }),
  });
  logLine('[main] spawned node pid=' + serverProc.pid + ' node=' + nodeExe);
  serverProc.on('error', (e) => logLine('[main] spawn error: ' + e));
  serverProc.stdout.on('data', (d) => logLine(d.toString().trim()));
  serverProc.stderr.on('data', (d) => logLine(d.toString().trim()));
  serverProc.on('exit', (code, sig) => logLine('[main] server exit code=' + code + ' sig=' + sig));
  serverProc.on('close', () => { serverProc = null; });
  saveConfig();
  return { ok: true, reused: false };
}

async function waitReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portIsDsh(port)) return true;
    await new Promise(r => setTimeout(r, 700));
  }
  return false;
}

function stopServer() {
  if (serverProc) {
    try { serverProc.kill(); } catch (e) { }
    serverProc = null;
  }
}

function logTail() {
  try {
    if (!fs.existsSync(LOG_FILE)) return '（无日志）';
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-30).join('\n');
  } catch (e) { return '（读取日志失败）'; }
}

// ---------------- 窗口 ----------------
let shuttingDown = false;

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#333333',
      height: 40,
    },
    backgroundColor: '#ffffff',
    icon: path.join(ROOT, 'resources', 'app', 'ui', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWin.loadFile(path.join(__dirname, 'ui', 'index.html'));

  mainWin.once('ready-to-show', () => mainWin.show());

  // 外部链接用系统浏览器
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWin.webContents.on('preload-error', (e, p, err) => logLine('[main] preload-error: ' + p + ' ' + err));
  mainWin.webContents.on('did-fail-load', (e, code, desc, url) => logLine('[main] did-fail-load: ' + code + ' ' + desc + ' ' + url));
  mainWin.webContents.on('console-message', (e, level, message, line, sourceId) => {
    logLine('[ui-console] ' + message);
  });

  // 关闭确认（服务将停止）
  mainWin.on('close', (e) => {
    logLine('[main] close event, shuttingDown=' + shuttingDown);
    if (shuttingDown) return;
    e.preventDefault();
    dialog.showMessageBox(mainWin, {
      type: 'question',
      buttons: ['退出', '取消'],
      defaultId: 0,
      cancelId: 1,
      message: '关闭窗口将同时停止 DSH 服务。\n确定要退出吗？',
    }).then((r) => {
      logLine('[main] dialog response=' + r.response);
      if (r.response === 0) { shuttingDown = true; mainWin.close(); }
    });
  });

  mainWin.on('closed', () => {
    stopServer();
    mainWin = null;
    app.quit();
  });
}

// ---------------- IPC ----------------
function initIpc() {
  ipcMain.on('win:minimize', () => mainWin && mainWin.minimize());
  ipcMain.on('win:maximize-toggle', () => {
    if (!mainWin) return;
    if (mainWin.isMaximized()) mainWin.unmaximize(); else mainWin.maximize();
  });
  ipcMain.handle('win:is-maximized', () => mainWin ? mainWin.isMaximized() : false);
  ipcMain.on('win:close', () => mainWin && mainWin.close());

  ipcMain.handle('app:status', async () => {
    logLine('[main] app:status called');
    return {
      hasDsh: fs.existsSync(DSH_BIN),
      hasKey: hasKey(),
      ready: await portIsDsh(port),
      port,
    };
  });

  // 启动服务并等待就绪（UI 引导流程调用）
  ipcMain.handle('app:start', async () => {
    logLine('[main] app:start called port=' + port);
    const r = await startServer();
    if (!r.ok) return { ok: false, error: r.error, log: logTail() };
    const ready = await waitReady(150000);
    if (!ready) return { ok: false, error: '服务启动超时，请查看日志', log: logTail() };
    return { ok: true, port, reused: !!r.reused };
  });

  ipcMain.handle('app:submit-key', async (e, key) => {
    if (!key || !key.trim()) return { ok: false, error: 'Key 不能为空' };
    try {
      writeKey(key.trim());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('app:log-tail', () => logTail());
  ipcMain.on('app:log', (e, msg) => logLine('[ui] ' + msg));
}

// ---------------- 启动 ----------------
app.whenReady().then(async () => {
  initIpc();
  readConfig();
  createWindow();

  // 等待 UI 就绪后开始启动流程（UI 会轮询 app:status）
});

app.on('window-all-closed', () => app.quit());

// 单实例
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });
}
