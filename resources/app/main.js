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
      height: 30,
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
    deployPlugins();
    return { ok: true, port, reused: !!r.reused };
  });

  // 部署内置插件到 DSH profiles（幂等：客户端启动后自动加载）
  function profilePatchFile0() {
    const pd = path.join(HOME_DIR, 'profiles');
    try {
      for (const d of fs.readdirSync(pd)) {
        const f = path.join(pd, d, 'cordis.patch.yml');
        if (fs.existsSync(f)) return f;
      }
    } catch (e) { }
    return null;
  }

  function deployPlugins() {
    try {
      const srcDir = path.join(ROOT, 'plugins');
      if (!fs.existsSync(srcDir)) return;
      const pd = path.join(HOME_DIR, 'profiles');
      if (!fs.existsSync(pd)) return; // DSH 尚未建立 profiles，下次启动再部署
      const nm = path.join(pd, 'node_modules');
      fs.mkdirSync(nm, { recursive: true });
      // js-yaml 保底（profiles 缺则从 app 依赖复制）
      const yamlSrc = path.join(APP_DIR, 'node_modules', 'js-yaml');
      const yamlDst = path.join(nm, 'js-yaml');
      if (!fs.existsSync(yamlDst) && fs.existsSync(yamlSrc)) {
        fs.cpSync(yamlSrc, yamlDst, { recursive: true });
      }
      // 插件包
      for (const name of fs.readdirSync(srcDir)) {
        const pkgDir = path.join(nm, name);
        if (fs.existsSync(pkgDir)) continue;
        fs.cpSync(path.join(srcDir, name), pkgDir, { recursive: true });
        logLine('[plugins] deployed ' + name);
      }
      // patch 条目（js-yaml 操作；新增行必须放进 insert 块，cordis patch 才生效）
      const pf = profilePatchFile0();
      if (pf && YAML) {
        let data;
        try { data = YAML.load(stripBom(fs.readFileSync(pf, 'utf8'))); } catch (e) { data = []; }
        const arr = Array.isArray(data) ? data : [];
        const hasName = (n) => arr.some((p) => p && p.name === n) ||
          arr.some((p) => p && Array.isArray(p.insert) && p.insert.some((q) => q && q.name === n));
        let changed = false;
        for (const name of fs.readdirSync(srcDir)) {
          if (hasName(name)) continue;
          const id = 'builtin-' + name.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 20);
          const ins = arr.find((p) => p && Array.isArray(p.insert));
          if (ins) ins.insert.push({ id, name });
          else arr.push({ insert: [{ id, name }] });
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(pf, YAML.dump(arr, { lineWidth: 120 }), 'utf8');
          logLine('[plugins] patch updated: ' + pf);
        }
      }
    } catch (e) {
      logLine('[plugins] deploy error: ' + (e && e.message || e));
    }
  }

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
