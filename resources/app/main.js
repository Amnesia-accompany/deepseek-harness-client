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
const https = require('https');

// ---------------- 路径 ----------------
const ROOT = path.dirname(path.dirname(app.getAppPath())); // 客户端根目录（resources 的上一级）
const APP_DIR = path.join(ROOT, 'app');               // dsh 依赖
const DSH_BIN = path.join(APP_DIR, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.join(DATA_DIR, 'server.log');
let YAML = null;
try { YAML = require(path.join(APP_DIR, 'node_modules', 'js-yaml')); } catch (e) { }
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

// 外部根目录/文件（用户通过「打开文件夹/打开文件」加入资源管理器）
let extraRoots = [];

function readConfig() {
  try {
    const cfg = JSON.parse(stripBom(fs.readFileSync(CONFIG_FILE, 'utf8')));
    if (typeof cfg.port === 'number') port = cfg.port;
    if (typeof cfg.baseURL === 'string' && cfg.baseURL) baseURL = cfg.baseURL;
    if (Array.isArray(cfg.extraRoots)) {
      extraRoots = cfg.extraRoots.filter((r) => typeof r === 'string' && r.length > 0);
    }
  } catch (e) { /* 默认 3080 */ }
}

function saveConfig() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const cfg = { port, baseURL: baseURL || null, configured: true, extraRoots };
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

// 读取 Key（不回显明文）
function readKey() {
  try {
    if (!fs.existsSync(CRED_FILE)) return null;
    const lines = stripBom(fs.readFileSync(CRED_FILE, 'utf8')).split(/\r?\n/);
    for (const l of lines) {
      const m = l.match(/^\s*DEEPSEEK_API_KEY\s*:\s*(\S+)/);
      if (m && m[1]) return m[1];
    }
  } catch (e) { }
  return null;
}

// Key 掩码显示：sk-***abcd
function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return k.slice(0, 2) + '***';
  return k.slice(0, 3) + '***' + k.slice(-4);
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

// 服务就绪信号：dsh web 启动成功后打印 "dsh web: http://..." 行
let stdoutReady = null;

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
  serverProc.stdout.on('data', (d) => {
    const text = d.toString().trim();
    logLine(text);
    // 服务打印 URL 行 = 就绪信号，立即唤醒等待方（比轮询快 1~2 秒）
    if (/http:\/\/127\.0\.0\.1:\d+/.test(text) && stdoutReady) {
      const r = stdoutReady; stdoutReady = null; r();
    }
  });
  serverProc.stderr.on('data', (d) => logLine(d.toString().trim()));
  serverProc.on('exit', (code, sig) => logLine('[main] server exit code=' + code + ' sig=' + sig));
  serverProc.on('close', () => { serverProc = null; });
  saveConfig();
  return { ok: true, reused: false };
}

async function waitReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  // 快速通道：stdout 就绪信号
  const signal = new Promise((resolve) => { stdoutReady = resolve; });
  let fired = false;
  signal.then(() => { fired = true; }).catch(() => { });
  while (Date.now() < deadline) {
    const won = await Promise.race([
      signal.then(() => 'signal'),
      new Promise((r) => setTimeout(() => r('poll'), 400)),
    ]);
    if (won === 'signal') return true;
    if (await portIsDsh(port)) return true;
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

  // 工具箱：Key 状态（只返回掩码，不回显明文）
  ipcMain.handle('app:key-info', () => {
    const k = readKey();
    return { hasKey: !!k, masked: k ? maskKey(k) : '' };
  });

  // 工具箱：查询 DeepSeek 余额（https://api.deepseek.com/user/balance）
  ipcMain.handle('app:check-balance', async () => {
    const k = readKey();
    if (!k) return { ok: false, error: '尚未配置 API Key' };
    return new Promise((resolve) => {
      let origin = 'https://api.deepseek.com';
      try {
        if (baseURL && /deepseek\.com/i.test(baseURL)) origin = new URL(baseURL).origin;
      } catch (e) { }
      const req = https.get(origin + '/user/balance', {
        headers: { 'Authorization': 'Bearer ' + k, 'Accept': 'application/json' },
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', (d) => { body += d; if (body.length > 200000) req.destroy(); });
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            if (res.statusCode !== 200) {
              const msg = (j && j.error && j.error.message) || body.slice(0, 200);
              return resolve({ ok: false, error: '查询失败(' + res.statusCode + ')：' + msg });
            }
            const infos = (j.balance_infos || []).map((b) => ({
              currency: b.currency,
              total: b.total_balance,
              granted: b.granted_balance,
              topped: b.topped_up_balance,
            }));
            resolve({ ok: true, available: !!j.is_available, infos });
          } catch (e) { resolve({ ok: false, error: '响应解析失败' }); }
        });
        res.on('error', () => resolve({ ok: false, error: '网络错误' }));
      });
      req.on('error', () => resolve({ ok: false, error: '无法连接 DeepSeek（请检查网络或代理）' }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '请求超时' }); });
    });
  });

  ipcMain.handle('app:log-tail', () => logTail());
  ipcMain.on('app:log', (e, msg) => logLine('[ui] ' + msg));

  // ---------------- 文件浏览器（工作区 + 外部根，防路径穿越） ----------------
  const WORKSPACE_REAL = path.resolve(WORKSPACE);

  function safeResolve(rel) {
    // 绝对路径走外部根；相对路径走工作区；最终必须落在已注册根之下
    let target;
    try {
      target = path.isAbsolute(rel || '') ? path.resolve(rel) : path.resolve(WORKSPACE_REAL, rel || '.');
    } catch (e) { return null; }
    if (target === WORKSPACE_REAL || target.startsWith(WORKSPACE_REAL + path.sep)) return target;
    for (const r of extraRoots) {
      const rr = path.resolve(r);
      if (target === rr || target.startsWith(rr + path.sep)) return target;
    }
    return null;
  }

  // 所有根（仅用户添加的外部根）
  function allRoots() {
    const list = [];
    for (const r of extraRoots) {
      try {
        const st = fs.statSync(r);
        list.push({ rel: r, name: path.basename(r), dir: st.isDirectory(), ext: true });
      } catch (e) { }
    }
    return list;
  }

  ipcMain.handle('fs:roots', () => allRoots());

  // 打开系统文件夹选择框 → 加入资源管理器
  ipcMain.handle('fs:pick-folder', async () => {
    if (!mainWin) return { ok: false, error: '窗口未就绪' };
    const r = await dialog.showOpenDialog(mainWin, {
      title: '选择要加入资源管理器的文件夹',
      properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    const p = path.resolve(r.filePaths[0]);
    if (extraRoots.indexOf(p) >= 0) return { ok: false, error: '该文件夹已在资源管理器中' };
    try {
      if (!fs.statSync(p).isDirectory()) return { ok: false, error: '不是文件夹' };
    } catch (e) { return { ok: false, error: '无法访问该文件夹' }; }
    extraRoots.push(p);
    saveConfig();
    return { ok: true, roots: allRoots() };
  });

  // 打开系统文件选择框 → 加入资源管理器
  ipcMain.handle('fs:pick-file', async () => {
    if (!mainWin) return { ok: false, error: '窗口未就绪' };
    const r = await dialog.showOpenDialog(mainWin, {
      title: '选择要加入资源管理器的文件',
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    const p = path.resolve(r.filePaths[0]);
    if (extraRoots.indexOf(p) >= 0) return { ok: false, error: '该文件已在资源管理器中' };
    try {
      if (!fs.statSync(p).isFile()) return { ok: false, error: '不是文件' };
    } catch (e) { return { ok: false, error: '无法访问该文件' }; }
    extraRoots.push(p);
    saveConfig();
    return { ok: true, roots: allRoots() };
  });

  // 从资源管理器移除根（不删除磁盘文件）
  ipcMain.handle('fs:remove-root', async (e, rel) => {
    if (!rel || !path.isAbsolute(rel)) return { ok: false, error: '只能移除外部根' };
    const idx = extraRoots.indexOf(path.resolve(rel));
    if (idx < 0) return { ok: false, error: '未找到该根' };
    extraRoots.splice(idx, 1);
    saveConfig();
    return { ok: true, roots: allRoots() };
  });

  ipcMain.handle('fs:root', () => WORKSPACE_REAL);

  ipcMain.handle('fs:list', async (e, rel) => {
    try {
      const dir = safeResolve(rel);
      if (!dir) return { ok: false, error: '路径越界' };
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const items = entries
        .filter((d) => d.name !== 'node_modules' && d.name !== '.git' && d.name !== '.dsh' && !d.name.startsWith('.DS_Store'))
        .map((d) => {
          const full = path.join(dir, d.name);
          let size = 0;
          let isDir = d.isDirectory();
          if (!isDir) { try { size = fs.statSync(full).size; } catch (e) { } }
          return { name: d.name, dir: isDir, size };
        })
        .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : (a.dir ? -1 : 1)));
      return { ok: true, items, root: WORKSPACE_REAL };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('fs:reveal', async (e, rel) => {
    try {
      const target = safeResolve(rel);
      if (!target) return { ok: false, error: '路径越界' };
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        shell.openPath(target);
      } else {
        shell.showItemInFolder(target);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('fs:read', async (e, rel) => {
    try {
      const file = safeResolve(rel);
      if (!file) return { ok: false, error: '路径越界' };
      const stat = fs.statSync(file);
      if (!stat.isFile()) return { ok: false, error: '不是文件' };
      if (stat.size > 2 * 1024 * 1024) return { ok: false, error: '文件超过 2MB，请用其他工具打开' };
      const buf = fs.readFileSync(file);
      // 二进制检测：前 8KB 含 NUL 字节视为二进制
      const probe = buf.slice(0, 8192);
      if (probe.indexOf(0) >= 0) return { ok: false, error: '二进制文件，无法预览' };
      return { ok: true, content: stripBom(buf.toString('utf8')), name: path.basename(file) };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('fs:write', async (e, rel, content) => {
    try {
      const file = safeResolve(rel);
      if (!file) return { ok: false, error: '路径越界' };
      if (typeof content !== 'string' || content.length > 4 * 1024 * 1024) {
        return { ok: false, error: '内容不合法或过大' };
      }
      fs.writeFileSync(file, content, 'utf8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  // 新建文件 / 新建文件夹 / 删除（均限定工作区内）
  ipcMain.handle('fs:create-file', async (e, parentRel, name) => {
    try {
      const dir = safeResolve(parentRel || '.');
      if (!dir) return { ok: false, error: '路径越界' };
      const clean = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
      if (!clean) return { ok: false, error: '文件名不合法' };
      const target = path.join(dir, clean);
      if (fs.existsSync(target)) return { ok: false, error: '同名文件已存在' };
      fs.writeFileSync(target, '', 'utf8');
      return { ok: true, rel: path.relative(WORKSPACE_REAL, target).split(path.sep).join('/') };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('fs:create-dir', async (e, parentRel, name) => {
    try {
      const dir = safeResolve(parentRel || '.');
      if (!dir) return { ok: false, error: '路径越界' };
      const clean = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
      if (!clean) return { ok: false, error: '文件夹名不合法' };
      const target = path.join(dir, clean);
      if (fs.existsSync(target)) return { ok: false, error: '同名文件夹已存在' };
      fs.mkdirSync(target, { recursive: false });
      return { ok: true, rel: path.relative(WORKSPACE_REAL, target).split(path.sep).join('/') };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('fs:delete', async (e, rel) => {
    try {
      const target = safeResolve(rel);
      if (!target) return { ok: false, error: '路径越界' };
      if (target === WORKSPACE_REAL) return { ok: false, error: '不能删除工作区根目录' };
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  // ================= 设置：Skills 管理 =================
  function scanSkill(dir, name, source, preset) {
    let desc = '';
    try {
      const main = fs.readdirSync(dir).find((f) => /skill\.md$/i.test(f));
      if (main) {
        const txt = stripBom(fs.readFileSync(path.join(dir, main), 'utf8'));
        const l = txt.split(/\r?\n/).find((x) => x.trim().startsWith('#'));
        desc = (l ? l.replace(/^#+\s*/, '') : txt.slice(0, 80)).slice(0, 140);
      }
    } catch (e) { }
    return { name, source, preset: preset || '', desc, path: dir };
  }

  ipcMain.handle('set:skills-list', () => {
    const out = [];
    // 用户 skills：~/.dsh/skills/<name>/
    const userDir = path.join(HOME_DIR, 'skills');
    try {
      if (fs.existsSync(userDir)) {
        for (const d of fs.readdirSync(userDir, { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          out.push(scanSkill(path.join(userDir, d.name), d.name, 'user', ''));
        }
      }
    } catch (e) { }
    // 内置 skills：dsh 包 config/agent-presets/*/skills/
    const apDir = path.join(APP_DIR, 'node_modules', '@deepseek-ai', 'dsh', 'config', 'agent-presets');
    try {
      if (fs.existsSync(apDir)) {
        for (const preset of fs.readdirSync(apDir, { withFileTypes: true })) {
          if (!preset.isDirectory()) continue;
          const sk = path.join(apDir, preset.name, 'skills');
          if (!fs.existsSync(sk)) continue;
          for (const d of fs.readdirSync(sk, { withFileTypes: true })) {
            if (!d.isDirectory()) continue;
            out.push(scanSkill(path.join(sk, d.name), d.name, 'builtin', preset.name));
          }
        }
      }
    } catch (e) { }
    return { ok: true, items: out };
  });

  ipcMain.handle('set:skill-create', async (e, name) => {
    try {
      const clean = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
      if (!clean) return { ok: false, error: '名称不合法' };
      const dir = path.join(HOME_DIR, 'skills', clean);
      if (fs.existsSync(dir)) return { ok: false, error: '同名 skill 已存在' };
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'SKILL.md'),
        '# ' + clean + '\n\n## 用途\n（在这里描述这个 skill 的用途和使用场景）\n\n## 内容\n（在这里写详细的技能指令）\n', 'utf8');
      return { ok: true };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('set:skill-delete', async (e, name) => {
    try {
      const clean = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
      const dir = path.join(HOME_DIR, 'skills', clean);
      if (!dir.startsWith(path.join(HOME_DIR, 'skills') + path.sep)) return { ok: false, error: '只能删除用户 skill' };
      if (!fs.existsSync(dir)) return { ok: false, error: '未找到该 skill' };
      fs.rmSync(dir, { recursive: true, force: true });
      return { ok: true };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  // ================= 设置：MCP 管理（cordis.patch.yml） =================
  function profilePatchFile() {
    const pd = path.join(HOME_DIR, 'profiles');
    try {
      for (const d of fs.readdirSync(pd)) {
        const f = path.join(pd, d, 'cordis.patch.yml');
        if (fs.existsSync(f)) return f;
      }
    } catch (e) { }
    return null;
  }

  ipcMain.handle('set:mcp-list', () => {
    const pf = profilePatchFile();
    if (!pf) return { ok: true, items: [], file: null };
    if (!YAML) return { ok: false, error: 'YAML 库不可用' };
    let data;
    try { data = YAML.load(stripBom(fs.readFileSync(pf, 'utf8'))); } catch (e) { return { ok: false, error: '无法解析 cordis.patch.yml：' + e.message }; }
    const arr = Array.isArray(data) ? data : [];
    const items = arr.filter((p) => p && p.name === '@deepseek-ai/dsh-mcp-client').map((p) => ({
      id: p.id, serverName: (p.config || {}).serverName, transport: (p.config || {}).transport,
      command: (p.config || {}).command, args: (p.config || {}).args, url: (p.config || {}).url,
    }));
    return { ok: true, items, file: pf };
  });

  function writePatch(arr) {
    const pf = profilePatchFile();
    if (!pf) return { ok: false, error: '未找到 profile 配置目录' };
    fs.writeFileSync(pf, YAML.dump(arr, { lineWidth: 120 }), 'utf8');
    return { ok: true };
  }

  ipcMain.handle('set:mcp-save', async (e, cfg) => {
    if (!YAML) return { ok: false, error: 'YAML 库不可用' };
    const pf = profilePatchFile();
    if (!pf) return { ok: false, error: '未找到 profile 配置目录' };
    let data;
    try { data = YAML.load(stripBom(fs.readFileSync(pf, 'utf8'))); } catch (err) { return { ok: false, error: '无法解析现有配置：' + err.message }; }
    const arr = Array.isArray(data) ? data : [];
    const serverName = String(cfg.serverName || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
    if (!serverName) return { ok: false, error: '请填写服务器名称（serverName）' };
    const transport = cfg.transport === 'http' ? 'streamable-http' : 'stdio';
    const config = { serverName, transport };
    if (transport === 'stdio') {
      if (!cfg.command) return { ok: false, error: '请填写启动命令' };
      config.command = cfg.command;
      if (cfg.args && cfg.args.trim()) config.args = cfg.args.split(/\s+/).filter(Boolean);
    } else {
      if (!cfg.url) return { ok: false, error: '请填写服务器 URL' };
      config.url = cfg.url;
    }
    let id = String(cfg.id || '').trim();
    if (!id) {
      id = 'mcp-' + serverName.toLowerCase().replace(/[^a-z0-9_-]/g, '') + '-' + Math.random().toString(36).slice(2, 6);
      arr.push({ id, name: '@deepseek-ai/dsh-mcp-client', config });
    } else {
      const hit = arr.find((p) => p && p.id === id);
      if (hit) { hit.config = config; } else { arr.push({ id, name: '@deepseek-ai/dsh-mcp-client', config }); }
    }
    return writePatch(arr);
  });

  ipcMain.handle('set:mcp-delete', async (e, id) => {
    if (!YAML) return { ok: false, error: 'YAML 库不可用' };
    const pf = profilePatchFile();
    if (!pf) return { ok: false, error: '未找到 profile 配置目录' };
    let data;
    try { data = YAML.load(stripBom(fs.readFileSync(pf, 'utf8'))); } catch (err) { return { ok: false, error: '无法解析现有配置：' + err.message }; }
    const arr = (Array.isArray(data) ? data : []).filter((p) => !(p && p.id === id && p.name === '@deepseek-ai/dsh-mcp-client'));
    return writePatch(arr);
  });

  // ================= 设置：插件市场（awesome-deepseek-harness） =================
  let marketCache = null;
  let marketCacheAt = 0;

  function parseAwesome(md) {
    const catMap = {
      'Official': '官方', 'Profiles & Patch Layers': '配置方案', 'Harnesses & Runtimes': '运行时',
      'Security & Permissions': '安全与权限', 'Session & Memory Management': '会话与记忆',
      'Cost & Usage Tracking': '用量与计费', 'Channel / IM Bridges': '消息与接入',
      'Plugin Marketplaces & Ecosystem': '插件市场', 'Visualization': '可视化',
      'Slides / PPT': '演示文稿', 'Coding': '编程开发', 'Agents': '智能体',
      'Loops (Auto-Research, Self-Improve, etc.)': '自动化循环', 'MCP Servers': 'MCP 服务器',
      'Orchestrators & Aggregators': '编排与聚合', 'UI / Clients': '界面与客户端',
      'Skills': '技能', 'Resources': '资源',
    };
    const cats = [];
    let cur = null;
    for (const line of md.split(/\r?\n/)) {
      const h = line.match(/^## (.+)$/);
      if (h) {
        const en = h[1].trim();
        if (catMap[en]) { cur = { en, zh: catMap[en], items: [] }; cats.push(cur); }
        else cur = null;
        continue;
      }
      if (!cur) continue;
      const m = line.match(/^\s*-\s*\[([^\]]+)\]\(([^)]+)\)\s*[-–—]?\s*(.*)$/);
      if (m) {
        cur.items.push({
          name: m[1].trim(),
          url: m[2].trim(),
          desc: (m[3] || '').trim().replace(/\s+/g, ' ').slice(0, 220),
        });
      }
    }
    return cats.filter((c) => c.items.length);
  }

  ipcMain.handle('set:market-list', async (e, force) => {
    if (marketCache && Date.now() - marketCacheAt < 10 * 60 * 1000 && !force) {
      return { ok: true, cached: true, cats: marketCache };
    }
    return new Promise((resolve) => {
      const req = https.get('https://api.github.com/repos/Dominic789654/awesome-deepseek-harness/readme', {
        headers: { 'User-Agent': 'deepseek-harness-client' },
        timeout: 12000,
      }, (res) => {
        let body = '';
        res.on('data', (d) => { body += d; if (body.length > 2 * 1024 * 1024) req.destroy(); });
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            if (!j.content) return resolve({ ok: false, error: '获取插件列表失败（' + (j.message || '未知') + '）' });
            const md = Buffer.from(j.content.replace(/\s/g, ''), 'base64').toString('utf8');
            marketCache = parseAwesome(md);
            marketCacheAt = Date.now();
            resolve({ ok: true, cached: false, cats: marketCache });
          } catch (err) { resolve({ ok: false, error: '解析插件列表失败' }); }
        });
        res.on('error', () => resolve({ ok: false, error: '网络错误' }));
      });
      req.on('error', () => resolve({ ok: false, error: '无法连接 GitHub（请检查网络或代理）' }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '请求超时' }); });
    });
  });
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
