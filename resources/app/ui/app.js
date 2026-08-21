// 蓝色大肥鱼 DSH - UI 逻辑
// 启动流程：查询状态 → 无 Key 先填 Key → 等主进程把服务拉起 → 加载页面
const $ = (id) => document.getElementById(id);

let status = null;

// 视图切换（.show 类驱动，配合 CSS 过渡动画）
function show(el) {
  ['boot', 'error', 'keyform', 'stage'].forEach(id => $(id).classList.remove('show'));
  $(el).classList.add('show');
}

function bootMsg(m) { $('bootMsg').textContent = m; }

async function loadPage() {
  const st = await window.dsh.status();
  if (st.ready && st.port) {
    $('host').src = 'http://127.0.0.1:' + st.port + '/';
    show('stage');
  } else {
    setTimeout(loadPage, 600);
  }
}

async function start() {
  status = await window.dsh.status();

  if (!status.hasDsh) {
    show('error');
    $('errTitle').textContent = '未安装';
    $('errDetail').textContent = '未找到 DeepSeek Harness 核心。\n请先运行「deepseek-harness-client.exe」完成安装。';
    return;
  }
  if (!status.hasKey) {
    show('keyform');
    $('keyInput').focus();
    return;
  }
  show('boot');
  bootMsg('正在启动服务');
  const r = await window.dsh.start();
  if (!r.ok) {
    show('error');
    $('errTitle').textContent = '启动失败';
    $('errDetail').textContent = r.error + '\n\n最近日志：\n' + (r.log || '（无）');
    return;
  }
  bootMsg('正在加载界面');
  $('host').src = 'http://127.0.0.1:' + r.port + '/';
  $('host').onload = () => { window.dsh.log('iframe 已加载页面'); };
  show('stage');
}

$('keyOk').onclick = async () => {
  const key = $('keyInput').value.trim();
  if (!key) { $('keyErr').textContent = 'Key 不能为空'; return; }
  $('keyErr').textContent = '';
  const r = await window.dsh.submitKey(key);
  if (!r.ok) { $('keyErr').textContent = '保存失败：' + r.error; return; }
  start();
};

$('keyInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('keyOk').click();
});

$('errRetry').onclick = async () => {
  show('boot');
  bootMsg('正在重新启动');
  loadPage();
};

// ---------------- API Key / 余额面板 ----------------
let panelOpen = false;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshKeyInfo() {
  try {
    const info = await window.dsh.keyInfo();
    const el = $('pKeyState');
    if (info.hasKey) {
      el.textContent = '已配置  ' + info.masked;
      el.className = 'ok';
    } else {
      el.textContent = '未配置';
      el.className = 'bad';
    }
  } catch (e) {
    $('pKeyState').textContent = '查询失败';
  }
}

$('keyBtn').onclick = () => {
  panelOpen = !panelOpen;
  $('panel').classList.toggle('show', panelOpen);
  $('keyBtn').classList.toggle('active', panelOpen);
  if (panelOpen) refreshKeyInfo();
};

// 点击面板外部关闭（用 closest 匹配 keyBtn 内部元素，避免点击 svg/path 图标时误关面板）
document.addEventListener('click', (e) => {
  if (panelOpen && !e.target.closest('#panel') && !e.target.closest('#keyBtn')) {
    panelOpen = false;
    $('panel').classList.remove('show');
    $('keyBtn').classList.remove('active');
  }
});

$('pKeySave').onclick = async () => {
  const key = $('pKeyInput').value.trim();
  if (!key) {
    refreshKeyInfo();
    return;
  }
  const btn = $('pKeySave');
  btn.disabled = true;
  btn.textContent = '保存中…';
  const r = await window.dsh.submitKey(key);
  if (r.ok) {
    $('pKeyInput').value = '';
    btn.textContent = '已保存 ✓';
    refreshKeyInfo();
  } else {
    btn.textContent = '失败';
    $('pKeyState').textContent = '保存失败：' + r.error;
    $('pKeyState').className = 'bad';
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = '保存'; }, 1500);
};

$('pBalanceBtn').onclick = async () => {
  const btn = $('pBalanceBtn');
  btn.disabled = true;
  btn.textContent = '查询中…';
  const r = await window.dsh.checkBalance();
  const box = $('pBalance');
  if (!r.ok) {
    box.innerHTML = '<span class="bad">' + esc(r.error) + '</span>';
  } else {
    let html = '';
    if (!r.available) html += '<span class="bad">账户不可用</span><br>';
    (r.infos || []).forEach((b) => {
      const sym = b.currency === 'CNY' ? '¥' : (b.currency === 'USD' ? '$' : b.currency + ' ');
      html += '<div class="amt">' + sym + esc(b.total) + '</div>' +
        '<div class="small">' + esc(b.currency) + ' · 赠送 ' + sym + esc(b.granted) +
        ' · 充值 ' + sym + esc(b.topped) + '</div>';
    });
    if (!html) html = '（无余额数据）';
    box.innerHTML = html;
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = '查询余额'; }, 2000);
};

// ================= 选项卡：对话 / 文件 =================
$('tabChat').onclick = () => switchView('chat');
$('tabFiles').onclick = () => switchView('files');

function switchView(v) {
  document.body.classList.toggle('view-files', v === 'files');
  $('tabChat').classList.toggle('active', v === 'chat');
  $('tabFiles').classList.toggle('active', v === 'files');
  if (v === 'files') {
    if (openFiles.length) $('content-pane').classList.add('open');
    loadTree();
  }
}

// ================= 文件树 =================
let treeCache = {};   // dirRel -> {loaded:bool}
let expandedDirs = {};
let openFiles = [];   // [{ rel, name, content, dirty, history, historyIdx }]
let activeRel = null; // 当前激活的文件 rel
let suppressHistory = false;

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function listDir(rel) {
  const r = await window.dsh.fsList(rel);
  if (!r.ok) throw new Error(r.error);
  return r.items;
}

async function loadTree() {
  const tree = $('tree');
  try {
    const roots = await window.dsh.fsRoots();
    tree.innerHTML = '';
    for (const r of roots) {
      tree.appendChild(makeRootNode(r));
    }
    if (!roots.length) {
      tree.innerHTML = '<div class="tempty">资源管理器为空<br>（点击右上角 📂 添加文件夹，或 📄 添加文件）</div>';
    }
  } catch (e) {
    tree.innerHTML = '<div class="tempty">加载失败：' + escHtml(e.message) + '</div>';
  }
}

function makeRootNode(root) {
  // 外部根：绝对路径作 rel
  const it = { name: root.name, dir: root.dir, size: 0, external: root.ext };
  const rel = root.rel || '';
  const wrap = document.createElement('div');
  wrap.className = 'tnode tdir text-root';
  wrap.dataset.rel = rel;
  wrap.dataset.dir = '1';
  wrap.dataset.name = it.name;
  const row = document.createElement('div');
  row.className = 'tnode-row';
  const arrow = document.createElement('span');
  arrow.className = 'tarrow';
  if (root.dir) {
    arrow.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4 L10 8 L6 12"/></svg>';
  }
  const icon = document.createElement('span');
  icon.className = 'ticon';
  icon.textContent = root.dir ? '📁' : '📄';
  const name = document.createElement('span');
  name.className = 'tname';
  name.textContent = it.name;
  row.appendChild(arrow);
  row.appendChild(icon);
  row.appendChild(name);
  wrap.appendChild(row);
  const childBox = document.createElement('div');
  childBox.style.display = 'none';
  wrap.appendChild(childBox);

  if (root.dir) {
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row') && ev.target !== wrap) return;
      ev.stopPropagation();
      const isOpen = childBox.style.display !== 'none';
      childBox.style.display = isOpen ? 'none' : 'block';
      arrow.classList.toggle('open', !isOpen);
      if (!isOpen) {
        try {
          const kids = await listDir(rel);
          childBox.innerHTML = '';
          kids.forEach((k) => childBox.appendChild(makeNode(k, rel)));
          if (!kids.length) {
            const e = document.createElement('div');
            e.className = 'tempty';
            e.textContent = '（空文件夹）';
            childBox.appendChild(e);
          }
        } catch (err) {
          const e = document.createElement('div');
          e.className = 'tempty';
          e.textContent = '打开失败：' + escHtml(err.message);
          childBox.appendChild(e);
        }
      }
    };
  } else {
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row')) return;
      ev.stopPropagation();
      document.querySelectorAll('#tree .tnode.sel').forEach(n => n.classList.remove('sel'));
      wrap.classList.add('sel');
      openFile(rel, it.name);
    };
  }
  return wrap;
}

function makeNode(it, parentRel) {
  const rel = parentRel ? parentRel + '/' + it.name : it.name;
  const wrap = document.createElement('div');
  wrap.className = 'tnode' + (it.dir ? ' tdir' : '');
  wrap.dataset.rel = rel;
  wrap.dataset.dir = it.dir ? '1' : '0';
  wrap.dataset.name = it.name;
  const row = document.createElement('div');
  row.className = 'tnode-row';
  const arrow = document.createElement('span');
  arrow.className = 'tarrow';
  if (it.dir) {
    arrow.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4 L10 8 L6 12"/></svg>';
  }
  const icon = document.createElement('span');
  icon.className = 'ticon';
  icon.textContent = it.dir ? '📁' : '📄';
  const name = document.createElement('span');
  name.className = 'tname';
  name.textContent = it.name;
  row.appendChild(arrow);
  row.appendChild(icon);
  row.appendChild(name);
  if (!it.dir) {
    const sz = document.createElement('span');
    sz.className = 'tsize';
    sz.textContent = fmtSize(it.size);
    row.appendChild(sz);
  }
  row.style.paddingLeft = (parentRel ? (parentRel.split('/').length) * 14 : 0) + 8 + 'px';
  wrap.appendChild(row);

  if (it.dir) {
    const childBox = document.createElement('div');
    childBox.style.display = expandedDirs[rel] ? 'block' : 'none';
    if (expandedDirs[rel]) arrow.classList.add('open');
    wrap.appendChild(childBox);
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row') && ev.target !== wrap) return;
      ev.stopPropagation();
      const isOpen = childBox.style.display !== 'none';
      childBox.style.display = isOpen ? 'none' : 'block';
      arrow.classList.toggle('open', !isOpen);
      if (!isOpen) {
        try {
          const kids = await listDir(rel);
          childBox.innerHTML = '';
          kids.forEach((k) => childBox.appendChild(makeNode(k, rel)));
          if (!kids.length) {
            const e = document.createElement('div');
            e.className = 'tempty';
            e.textContent = '（空文件夹）';
            childBox.appendChild(e);
          }
        } catch (err) {
          const e = document.createElement('div');
          e.className = 'tempty';
          e.textContent = '打开失败：' + escHtml(err.message);
          childBox.appendChild(e);
        }
      }
    };
  } else {
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row')) return;
      ev.stopPropagation();
      document.querySelectorAll('#tree .tnode.sel').forEach(n => n.classList.remove('sel'));
      wrap.classList.add('sel');
      openFile(rel, it.name);
    };
  }
  return wrap;
}

// ================= 编辑器（多标签 + 行号 + 语法高亮） =================
const LINE_H = 20;   // 行高（px），与 CSS 一致
const PAD_V = 12;    // 编辑器上下内边距（px）
let overlayTimer = null;

function cur() {
  return openFiles.find(f => f.rel === activeRel) || null;
}

// —— 文件标签栏 ——
function renderTabs() {
  const bar = $('filetabs');
  bar.innerHTML = '';
  if (!openFiles.length) return;
  openFiles.forEach((f) => {
    const t = document.createElement('div');
    t.className = 'ftab' + (f.rel === activeRel ? ' active' : '');
    t.title = f.rel;
    const nm = document.createElement('span');
    nm.className = 'ftab-name';
    nm.textContent = f.name + (f.dirty ? ' ●' : '');
    const x = document.createElement('span');
    x.className = 'ftab-x';
    x.textContent = '✕';
    x.title = '关闭标签';
    x.onclick = (e) => { e.stopPropagation(); closeTab(f.rel); };
    t.appendChild(nm);
    t.appendChild(x);
    t.onclick = () => activateFile(f.rel);
    bar.appendChild(t);
  });
}

async function openFile(rel, name) {
  const existing = openFiles.find(f => f.rel === rel);
  if (existing) { activateFile(rel); return; }
  const r = await window.dsh.fsRead(rel);
  if (!r.ok) {
    $('editorPath').textContent = rel;
    $('editorDirty').textContent = r.error;
    $('editorDirty').className = 'dirty';
    return;
  }
  openFiles.push({ rel, name, content: r.content, dirty: false, history: [r.content], historyIdx: 0 });
  activateFile(rel);
}

function activateFile(rel) {
  const f = openFiles.find(x => x.rel === rel);
  if (!f) return;
  activeRel = rel;
  $('editor').value = f.content;
  $('contentName').textContent = f.name;
  $('editorPath').textContent = f.rel;
  updateDirtyUI(f);
  $('content-pane').classList.add('open');
  renderTabs();
  renderOverlay();
  $('editor').focus();
}

function closeTab(rel) {
  const idx = openFiles.findIndex(f => f.rel === rel);
  if (idx < 0) return;
  const f = openFiles[idx];
  if (f.dirty && !confirm('「' + f.name + '」有未保存的修改，确定关闭？')) return;
  openFiles.splice(idx, 1);
  if (activeRel === rel) {
    if (openFiles.length) {
      activateFile(openFiles[Math.min(idx, openFiles.length - 1)].rel);
    } else {
      clearEditorPane();
    }
  } else {
    renderTabs();
  }
}

function clearEditorPane() {
  activeRel = null;
  $('content-pane').classList.remove('open');
  $('contentName').textContent = '未打开文件';
  $('editor').value = '';
  $('editorPath').textContent = '';
  $('editorDirty').textContent = '';
  $('editorDirty').className = '';
  $('highlight').innerHTML = '';
  $('gutterInner').textContent = '';
  $('gutterInner').style.height = '0px';
  renderTabs();
}

function updateDirtyUI(f) {
  if (!f) return;
  $('editorDirty').textContent = f.dirty ? '● 未保存' : '';
  $('editorDirty').className = f.dirty ? 'dirty' : '';
}

function snapshot(f) {
  f.history = f.history.slice(0, f.historyIdx + 1);
  f.history.push($('editor').value);
  if (f.history.length > 100) f.history.shift();
  f.historyIdx = f.history.length - 1;
}

$('editor').addEventListener('input', () => {
  const f = cur();
  if (!f) return;
  f.content = $('editor').value;
  f.dirty = true;
  updateDirtyUI(f);
  if (!suppressHistory) snapshot(f);
  renderTabs();
  scheduleOverlay();
});

function applyHistory(f) {
  suppressHistory = true;
  $('editor').value = f.history[f.historyIdx];
  suppressHistory = false;
  f.content = $('editor').value;
  f.dirty = true;
  updateDirtyUI(f);
  renderOverlay();
  renderTabs();
  $('editor').focus();
}

$('btnUndo').onclick = () => { const f = cur(); if (f && f.historyIdx > 0) { f.historyIdx--; applyHistory(f); } };
$('btnRedo').onclick = () => { const f = cur(); if (f && f.historyIdx < f.history.length - 1) { f.historyIdx++; applyHistory(f); } };

$('btnSave').onclick = async () => {
  const f = cur();
  if (!f) return;
  const btn = $('btnSave');
  btn.disabled = true;
  const r = await window.dsh.fsWrite(f.rel, $('editor').value);
  btn.disabled = false;
  if (r.ok) {
    f.dirty = false;
    f.content = $('editor').value;
    $('editorDirty').textContent = '已保存 ' + new Date().toLocaleTimeString();
    $('editorDirty').className = '';
    renderTabs();
    loadTree(); // 刷新树（大小变化）
  } else {
    $('editorDirty').textContent = '保存失败：' + r.error;
    $('editorDirty').className = 'dirty';
  }
};

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 's' && cur()) {
    e.preventDefault();
    $('btnSave').click();
  }
  if (ctrl && e.key.toLowerCase() === 'z') {
    if (document.activeElement === $('editor')) { e.preventDefault(); $('btnUndo').click(); }
  }
  if (ctrl && e.key.toLowerCase() === 'y') {
    if (document.activeElement === $('editor')) { e.preventDefault(); $('btnRedo').click(); }
  }
});

// —— 行号 + 高亮重绘（滚动同步） ——
function syncScroll() {
  const ed = $('editor');
  $('gutter').scrollTop = ed.scrollTop;
  $('highlight').scrollTop = ed.scrollTop;
  $('highlight').scrollLeft = ed.scrollLeft;
}

$('editor').addEventListener('scroll', syncScroll);

function scheduleOverlay() {
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => { overlayTimer = null; renderOverlay(); }, 80);
}

function renderOverlay() {
  const f = cur();
  const val = f ? f.content : '';
  const lines = val.split('\n');
  const n = lines.length;
  // 行号列
  const gi = $('gutterInner');
  gi.style.height = (n * LINE_H + PAD_V * 2) + 'px';
  if (n > 5000) {
    // 超大文件：纯文本行号，避免海量节点
    let t = '';
    for (let i = 1; i <= n; i++) t += i + '\n';
    gi.textContent = t;
  } else {
    gi.textContent = '';
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= n; i++) {
      const d = document.createElement('div');
      d.style.height = LINE_H + 'px';
      d.textContent = String(i);
      frag.appendChild(d);
    }
    gi.appendChild(frag);
  }
  // 高亮层
  const lang = f ? langForPath(f.name) : '';
  const hl = highlightLines(lines, lang);
  $('highlight').innerHTML = hl === null ? escHtml(val) : hl;
  syncScroll();
}

// —— 轻量语法高亮（VSCode Light+ 配色） ——
const HL_KEYWORDS = {
  javascript: 'abstract arguments async await boolean break byte case catch char class const continue debugger default delete do double else enum eval export extends false final finally float for function goto if implements import in instanceof int interface let long native new null package private protected public return short static super switch synchronized this throw throws transient true try typeof var void volatile while with yield of undefined',
  python: 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case',
  clike: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false null class new delete this friend virtual override public private protected template typename namespace using try catch throw finally string',
  shell: 'if then else elif fi for while until do done case esac in function return exit echo export local readonly set unset shift source printf read cd pwd ls cat mkdir rm cp mv grep sed awk sudo true false',
  yaml: 'true false null yes no on off',
  sql: 'select from where insert into values update set delete create table index view drop alter join left right inner outer on group by order having limit offset and or not null primary key foreign references unique default',
  json: 'true false null',
  ini: 'true false',
  powershell: 'function param return if else elseif for foreach while do until switch break continue exit write-host write-output new-object get-content set-content true false',
};
const HL_BLOCK = { javascript: 1, clike: 1, css: 1, markup: 1 };
const HL_LINE = { javascript: '//', clike: '//', shell: '#', python: '#', yaml: '#', sql: '--', ini: '#', powershell: '#' };

function langForPath(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  switch (ext) {
    case 'js': case 'mjs': case 'cjs': case 'jsx': case 'ts': case 'tsx': case 'vue': return 'javascript';
    case 'json': case 'jsonc': return 'json';
    case 'py': case 'pyw': return 'python';
    case 'html': case 'htm': case 'xml': case 'svg': case 'xhtml': return 'markup';
    case 'css': case 'scss': case 'less': return 'css';
    case 'md': case 'markdown': return 'markdown';
    case 'sh': case 'bash': case 'zsh': case 'fish': return 'shell';
    case 'ps1': return 'powershell';
    case 'yaml': case 'yml': return 'yaml';
    case 'java': case 'c': case 'h': case 'cpp': case 'hpp': case 'cc': case 'cxx': case 'cs': case 'go': case 'rs': case 'php': case 'rb': case 'kt': case 'kts': case 'swift': case 'scala': case 'm': return 'clike';
    case 'sql': return 'sql';
    case 'toml': case 'ini': case 'conf': case 'cfg': return 'ini';
    default: return '';
  }
}

function tokenizeLines(lines, lang) {
  const kwText = HL_KEYWORDS[lang] || '';
  const kwSet = kwText ? new Set(kwText.split(/\s+/)) : null;
  const useBlock = !!HL_BLOCK[lang];
  const lc = HL_LINE[lang] || '';
  const state = { inBlock: false };
  const out = [];
  for (let li = 0; li < lines.length; li++) out.push(tokenizeLine(lines[li], lang, kwSet, useBlock, lc, state));
  return out;
}

function tokenizeLine(line, lang, kwSet, useBlock, lc, state) {
  const tokens = [];
  const n = line.length;
  if (lang === 'markdown') {
    const hm = line.match(/^(#{1,6})\s/);
    if (hm) {
      tokens.push({ t: hm[1], c: 'kw' });
      tokens.push({ t: line.slice(hm[0].length - 1), c: '' });
      return tokens;
    }
    if (/^```/.test(line) || /^~~~/.test(line)) return [{ t: line, c: 'com' }];
  }
  let i = 0;
  while (i < n) {
    const rest = line.slice(i);
    if (state.inBlock) {
      const end = rest.indexOf('*/');
      if (end === -1) { tokens.push({ t: rest, c: 'com' }); break; }
      tokens.push({ t: rest.slice(0, end + 2), c: 'com' });
      i += end + 2;
      state.inBlock = false;
      continue;
    }
    if (lang === 'markup' && rest.startsWith('<!--')) {
      const end = rest.indexOf('-->');
      if (end === -1) { tokens.push({ t: rest, c: 'com' }); break; }
      tokens.push({ t: rest.slice(0, end + 3), c: 'com' });
      i += end + 3;
      continue;
    }
    if (lc && rest.startsWith(lc)) { tokens.push({ t: rest, c: 'com' }); break; }
    if (useBlock && rest.startsWith('/*')) {
      const end = rest.indexOf('*/', 2);
      if (end === -1) { tokens.push({ t: rest, c: 'com' }); state.inBlock = true; break; }
      tokens.push({ t: rest.slice(0, end + 2), c: 'com' });
      i += end + 2;
      continue;
    }
    const sm = rest.match(/^(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\\n]|\\.)*`)/);
    if (sm) { tokens.push({ t: sm[0], c: 'str' }); i += sm[0].length; continue; }
    if (lang === 'markup') {
      const tm = rest.match(/^<\/?[A-Za-z][\w.:-]*(?:\s+[^<>]*?)?\/?>/);
      if (tm) { tokens.push({ t: tm[0], c: 'tag' }); i += tm[0].length; continue; }
    }
    if (lang === 'css') {
      const cm = rest.match(/^#[0-9a-fA-F]{3,8}\b/);
      if (cm) { tokens.push({ t: cm[0], c: 'num' }); i += cm[0].length; continue; }
    }
    if (lang === 'yaml') {
      const ym = rest.match(/^[\w.-]+(?=:)/);
      if (ym) { tokens.push({ t: ym[0], c: 'kw' }); i += ym[0].length; continue; }
    }
    if (lang === 'ini') {
      const im = rest.match(/^\[[^\]]*\]/);
      if (im) { tokens.push({ t: im[0], c: 'tag' }); i += im[0].length; continue; }
    }
    if (kwSet) {
      const km = rest.match(/^[A-Za-z_$][\w$]*/);
      if (km && kwSet.has(km[0])) { tokens.push({ t: km[0], c: 'kw' }); i += km[0].length; continue; }
    }
    const nm = rest.match(/^(?:0x[\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (nm) { tokens.push({ t: nm[0], c: 'num' }); i += nm[0].length; continue; }
    let j = i + 1;
    while (j < n) {
      const ch = line[j];
      if (ch === '"' || ch === "'" || ch === '`') break;
      if (lc && line.startsWith(lc, j)) break;
      if (useBlock && ch === '/' && line[j + 1] === '*') break;
      if (kwSet && /[A-Za-z_$]/.test(ch)) break;
      if (/\d/.test(ch)) break;
      j++;
    }
    tokens.push({ t: line.slice(i, j), c: '' });
    i = j;
  }
  return tokens;
}

function highlightLines(lines, lang) {
  if (!lang || lines.length > 4000) return null; // 超长文件仅行号
  const toks = tokenizeLines(lines, lang);
  let html = '';
  for (let i = 0; i < lines.length; i++) {
    if (i) html += '\n';
    let lineHtml = '';
    for (const tok of toks[i]) {
      if (tok.c) lineHtml += '<span class="tok-' + tok.c + '">' + escHtml(tok.t) + '</span>';
      else lineHtml += escHtml(tok.t);
    }
    html += lineHtml;
  }
  return html;
}

$('btnOpenFile').onclick = async () => {
  const r = await window.dsh.fsPickFile();
  if (r.ok) loadTree();
};
$('btnOpenFolder').onclick = async () => {
  const r = await window.dsh.fsPickFolder();
  if (r.ok) loadTree();
};

// ================= 右键菜单：新建/删除 =================
let ctxTarget = null; // { rel, dir }

function showCtx(x, y, items) {
  const m = $('ctxMenu');
  m.innerHTML = '';
  items.forEach((it) => {
    if (it.sep) {
      const s = document.createElement('div');
      s.className = 'sep';
      m.appendChild(s);
      return;
    }
    const mi = document.createElement('div');
    mi.className = 'mi' + (it.danger ? ' danger' : '');
    mi.innerHTML = '<span>' + escHtml(it.icon || '') + '</span><span>' + escHtml(it.label) + '</span>';
    mi.onclick = () => { hideCtx(); it.action(); };
    m.appendChild(mi);
  });
  m.style.left = Math.min(x, window.innerWidth - 170) + 'px';
  m.style.top = Math.min(y, window.innerHeight - items.length * 34 - 20) + 'px';
  m.classList.add('show');
}

function hideCtx() {
  $('ctxMenu').classList.remove('show');
}

document.addEventListener('click', hideCtx);

// 右键菜单（document 级事件委托：树节点 / 树空白 / 其他区域）
document.addEventListener('contextmenu', (e) => {
  const node = e.target.closest ? e.target.closest('.tnode') : null;
  if (!node) {
    hideCtx();
    return;
  }
  e.preventDefault();
  const isDir = node.dataset.dir === '1';
  const rel = node.dataset.rel;
  const name = node.dataset.name || '';
  const isExtRoot = node.classList.contains('text-root');
  const parentRel = isDir ? rel : (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
  ctxTarget = parentRel ? { rel: parentRel, dir: true } : null;
  const items = [];
  if (isExtRoot) {
    items.push({
      icon: '➖', label: '从资源管理器移除', danger: true,
      action: () => removeRoot(rel),
    });
    items.push({ sep: true });
  }
  if (isDir) {
    items.push({ icon: '📂', label: '打开文件夹', action: () => revealPath(rel) });
  } else {
    items.push({ icon: '📖', label: '打开文件', action: () => openFile(rel, name) });
  }
  items.push(
    { icon: '📄', label: '新建文件', action: () => promptNewFile(parentRel || '') },
    { icon: '📁', label: '新建文件夹', action: () => promptNewDir(parentRel || '') },
  );
  items.push({ sep: true });
  items.push({
    icon: '🗑', label: isDir ? '删除文件夹' : '删除文件', danger: true,
    action: () => confirmDelete(rel, isDir),
  });
  showCtx(e.clientX, e.clientY, items);
});

// 树空白处右键：新建 / 刷新
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest || !e.target.closest('#tree')) return;
  if (e.target.closest('.tnode')) return; // 节点右键已处理
  e.preventDefault();
  ctxTarget = null;
  const items = [
    { icon: '📄', label: '新建文件', action: () => promptNewFile('') },
    { icon: '📁', label: '新建文件夹', action: () => promptNewDir('') },
    { icon: '🔄', label: '刷新', action: () => loadTree() },
  ];
  showCtx(e.clientX, e.clientY, items);
});

async function revealPath(rel) {
  const r = await window.dsh.fsReveal(rel);
  if (!r.ok) alert('打开失败：' + r.error);
}

async function removeRoot(rel) {
  if (!confirm('将「' + rel + '」从资源管理器中移除？（不会删除磁盘上的文件）')) return;
  const r = await window.dsh.fsRemoveRoot(rel);
  if (!r.ok) { alert('移除失败：' + r.error); return; }
  loadTree();
}

// 节点行内右键（与空白区分：确保命中节点）
// 节点本身也有 contextmenu —— 用上面的统一处理即可（node 命中）

// 输入弹窗
function promptInput(title, desc, placeholder, def) {
  return new Promise((resolve) => {
    $('promptTitle').textContent = title;
    $('promptDesc').textContent = desc || '';
    $('promptInput').value = def || '';
    $('promptInput').placeholder = placeholder || '';
    $('promptMask').classList.add('show');
    $('promptInput').focus();
    const done = (val) => {
      $('promptMask').classList.remove('show');
      resolve(val);
    };
    $('promptOk').onclick = () => done($('promptInput').value.trim());
    $('promptCancel').onclick = () => done(null);
    $('promptInput').onkeydown = (e) => {
      if (e.key === 'Enter') done($('promptInput').value.trim());
      if (e.key === 'Escape') done(null);
    };
  });
}

async function promptNewFile(parentRel) {
  const name = await promptInput('新建文件', '在 ' + (parentRel || '工作区根目录') + ' 下新建：', '例如 notes.txt');
  if (!name) return;
  const r = await window.dsh.fsCreateFile(parentRel, name);
  if (!r.ok) { alert('新建失败：' + r.error); return; }
  loadTree();
  openFile(r.rel, name);
}

async function promptNewDir(parentRel) {
  const name = await promptInput('新建文件夹', '在 ' + (parentRel || '工作区根目录') + ' 下新建：', '例如 myfolder');
  if (!name) return;
  const r = await window.dsh.fsCreateDir(parentRel, name);
  if (!r.ok) { alert('新建失败：' + r.error); return; }
  loadTree();
}

async function confirmDelete(rel, isDir) {
  const isAbsRoot = rel && rel.includes(':\\') || rel.includes(':/');
  const extra = isAbsRoot ? '（这是添加到资源管理器的根目录，将从磁盘上彻底删除）' : '';
  if (!confirm('确定删除「' + rel + '」' + (isDir ? ' 及其全部内容' : '') + ' 吗？' + extra + '此操作不可恢复！')) return;
  const r = await window.dsh.fsDelete(rel);
  if (!r.ok) { alert('删除失败：' + r.error); return; }
  const openIdx = openFiles.findIndex(f => f.rel === rel);
  if (openIdx >= 0) {
    openFiles.splice(openIdx, 1);
    if (activeRel === rel) {
      if (openFiles.length) activateFile(openFiles[Math.min(openIdx, openFiles.length - 1)].rel);
      else clearEditorPane();
    } else {
      renderTabs();
    }
  }
  loadTree();
}

// 主进程启动服务后页面就绪
window.dsh.isMaximized().then(() => { }).catch(() => { });
start();

// ================= 音乐播放器（网易云链接 / 歌单 / 顶栏歌词） =================
const musicAudio = $('musicAudio');
const mState = { list: [], index: -1, lrc: [], lrcIdx: -1, playing: false, singleText: '', lyricShown: false };
let mPanelOpen = false;

// 把歌词推送给 DSH 网页（侧边栏多行歌词卡插件接收；前奏未到时预位第一句）
function mPushLyric() {
  const frame = $('host');
  if (!frame || !frame.contentWindow) return;
  const idx = mState.lrcIdx >= 0 ? mState.lrcIdx : (mState.lrc.length ? 0 : -1);
  frame.contentWindow.postMessage({
    type: 'dsh-lyric',
    show: mState.lyricShown,
    lines: mState.lrc.map((l) => l.c),
    index: idx,
    single: mState.singleText || '',
  }, '*');
}

function mParseLrc(text) {
  const out = [];
  const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  const metaRe = /^(作词|作曲|编曲|制作人|和声编写|配唱|录音|混音|母带|监制|企划|统筹|封面|发行|出品|键盘|吉他|贝斯|鼓|弦乐|乐器|program|Program)[:：\s]/;
  for (const raw of String(text || '').split('\n')) {
    const times = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(raw))) {
      times.push(parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3] || '0') / 1000);
    }
    const content = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!content || metaRe.test(content)) continue;
    if (times.length) times.forEach((t) => out.push({ t, c: content }));
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// 多行歌词：渲染交给 DSH 侧边栏歌词卡（postMessage 推送）
function mRenderLrc() {
  mState.singleText = '';
  mState.lyricShown = true;
  mPushLyric();
}
function mUpdateLrcHighlight() {
  mPushLyric();
}
// 单行模式（无歌词 / 加载 / 提示）
function mShowLyricSingle(text) {
  mState.singleText = text || '';
  mState.lyricShown = true;
  mPushLyric();
}
function mHideLyric() {
  mState.lyricShown = false;
  mState.singleText = '';
  mPushLyric();
}

function mRenderList() {
  const box = $('mList');
  if (!mState.list.length) {
    box.innerHTML = '<div class="m-empty">歌单还是空的，粘贴一首网易云单曲链接吧 🎵</div>';
    return;
  }
  box.innerHTML = '';
  mState.list.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'm-item' + (i === mState.index ? ' playing' : '');
    row.innerHTML =
      '<span class="m-idx">' + (i === mState.index ? '♪' : (i + 1)) + '</span>' +
      '<span class="m-title">' + esc(item.title || '未知歌曲') + '</span>' +
      '<span class="m-artist">' + esc(item.artist || '') + '</span>' +
      '<button class="m-del" title="删除">×</button>';
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('m-del')) {
        mState.list.splice(i, 1);
        void window.dsh.musicSave(mState.list);
        if (mState.index === i) mStop();
        else if (mState.index > i) mState.index--;
        mRenderList();
        return;
      }
      mPlayAt(i);
    });
    box.appendChild(row);
  });
}

function mUpdateNow() {
  const item = mState.list[mState.index];
  $('mNow').textContent = item
    ? (mState.playing ? '♪ ' : '') + (item.title || '未知歌曲') + (item.artist ? ' - ' + item.artist : '')
    : '未在播放';
  $('mPlayBtn').textContent = mState.playing ? '⏸ 暂停' : '▶ 播放';
}

async function mPlayAt(i) {
  const item = mState.list[i];
  if (!item) return;
  mState.index = i;
  mShowLyricSingle('正在加载《' + (item.title || '') + '》…');
  let link;
  if (item.type === 'bili') link = 'https://www.bilibili.com/video/' + item.id;
  else if (item.type === 'direct') link = item.url;
  else link = 'https://music.163.com/song?id=' + item.id;
  const r = await window.dsh.musicResolve(link);
  if (!r.ok || !r.url) {
    const hint = (r && r.needCookie)
      ? '网易云音频需在「高级」里填入网易云 Cookie 后才能播放'
      : ((r && r.error) || '音频获取失败（可能受版权限制）');
    mShowLyricSingle('无法播放：' + hint);
    return;
  }
  mState.lrc = mParseLrc(r.lyric);
  mState.lrcIdx = -1;
  musicAudio.src = r.url;
  mState.playing = true;
  mUpdateNow();
  mRenderList();
  if (mState.lrc.length) mRenderLrc();
  else mShowLyricSingle('♪ ' + (r.title || item.title || ''));
  try { await musicAudio.play(); }
  catch (e) { mShowLyricSingle('播放失败（可能受版权或网络限制）'); }
}

function mTogglePlay() {
  if (mState.index < 0) {
    if (mState.list.length) mPlayAt(0);
    return;
  }
  if (musicAudio.paused) {
    musicAudio.play();
    mState.playing = true;
  } else {
    musicAudio.pause();
    mState.playing = false;
  }
  mUpdateNow();
}

function mStop() {
  musicAudio.pause();
  musicAudio.removeAttribute('src');
  mState.playing = false;
  mState.index = -1;
  mState.lrc = [];
  mHideLyric();
  mUpdateNow();
  mRenderList();
}

function mNext() { if (mState.list.length) mPlayAt((mState.index + 1) % mState.list.length); }
function mPrev() { if (mState.list.length) mPlayAt((mState.index - 1 + mState.list.length) % mState.list.length); }

musicAudio.ontimeupdate = () => {
  if (!mState.lrc.length) return;
  const t = musicAudio.currentTime;
  let lo = 0, hi = mState.lrc.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (mState.lrc[mid].t <= t) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (best !== mState.lrcIdx) {
    mState.lrcIdx = best;
    mUpdateLrcHighlight();
  }
};
musicAudio.onended = () => {
  if (mState.index >= 0 && mState.list.length > 1) mNext();
  else mStop();
};
musicAudio.onpause = () => { mState.playing = false; mUpdateNow(); };
musicAudio.onplay = () => { mState.playing = true; mUpdateNow(); };
musicAudio.onerror = () => { mShowLyricSingle('播放出错（音频链接可能已失效）'); };

$('musicBtn').onclick = () => {
  mPanelOpen = !mPanelOpen;
  $('musicPanel').classList.toggle('show', mPanelOpen);
  $('musicBtn').classList.toggle('active', mPanelOpen);
  if (mPanelOpen) {
    window.dsh.musicList().then((l) => {
      mState.list = l || [];
      mRenderList();
      mUpdateNow();
    });
  }
};

$('mAddBtn').onclick = async () => {
  const link = $('mLinkInput').value.trim();
  if (!link) return;
  const btn = $('mAddBtn');
  btn.disabled = true;
  $('mStatus').textContent = '解析中…';
  const r = await window.dsh.musicResolve(link);
  btn.disabled = false;
  if (!r.ok) {
    $('mStatus').textContent = '添加失败：' + (r.error || '链接无法解析');
    return;
  }
  const exists = mState.list.some((x) => x.id === r.id);
  if (exists) {
    $('mStatus').textContent = '歌单里已有《' + r.title + '》';
    $('mLinkInput').value = '';
    return;
  }
  mState.list.push({ id: r.id, title: r.title, artist: r.artist, type: r.type || 'netease', url: r.type === 'direct' ? link : undefined, addedAt: Date.now() });
  await window.dsh.musicSave(mState.list);
  $('mLinkInput').value = '';
  $('mStatus').textContent = '已添加《' + r.title + '》' + (r.artist ? ' - ' + r.artist : '');
  mRenderList();
};
$('mPlayBtn').onclick = mTogglePlay;
$('mNextBtn').onclick = mNext;
$('mPrevBtn').onclick = mPrev;

// 点击面板外部关闭音乐面板
document.addEventListener('click', (e) => {
  if (mPanelOpen && !e.target.closest('#musicPanel') && !e.target.closest('#musicBtn')) {
    mPanelOpen = false;
    $('musicPanel').classList.remove('show');
    $('musicBtn').classList.remove('active');
  }
});

// 音量调节（记住上次的音量）
(function initVolume() {
  let vol = 0.5;
  try { const saved = localStorage.getItem('dsh-music-vol'); if (saved != null) vol = Number(saved); } catch (e) { }
  if (!(vol >= 0 && vol <= 1)) vol = 0.5;
  musicAudio.volume = vol;
  const pct = Math.round(vol * 100);
  $('mVol').value = pct;
  $('mVolPct').textContent = pct + '%';
  $('mVol').addEventListener('input', () => {
    const v = Number($('mVol').value) / 100;
    musicAudio.volume = v;
    $('mVolPct').textContent = Math.round(v * 100) + '%';
    try { localStorage.setItem('dsh-music-vol', String(v)); } catch (e) { }
  });
})();
