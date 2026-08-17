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

// 点击面板外部关闭
document.addEventListener('click', (e) => {
  if (panelOpen && !e.target.closest('#panel') && e.target.id !== 'keyBtn') {
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
    if (currentFile) $('content-pane').classList.add('open');
    loadTree();
  }
}

// ================= 文件树 =================
let treeCache = {};   // dirRel -> {loaded:bool}
let expandedDirs = {};
let currentFile = null;   // { rel, name }
let dirty = false;

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
    const items = await listDir('');
    tree.innerHTML = '';
    items.forEach((it) => tree.appendChild(makeNode(it, '')));
    if (!items.length) tree.innerHTML = '<div class="tempty">工作区为空</div>';
  } catch (e) {
    tree.innerHTML = '<div class="tempty">加载失败：' + escHtml(e.message) + '</div>';
  }
}

function makeNode(it, parentRel) {
  const rel = parentRel ? parentRel + '/' + it.name : it.name;
  const wrap = document.createElement('div');
  wrap.className = 'tnode' + (it.dir ? ' tdir' : '');
  wrap.dataset.rel = rel;
  wrap.dataset.dir = it.dir ? '1' : '0';
  wrap.dataset.name = it.name;
  const arrow = document.createElement('span');
  arrow.className = 'tarrow';
  arrow.textContent = it.dir ? (expandedDirs[rel] ? '▼' : '▶') : '';
  const icon = document.createElement('span');
  icon.className = 'ticon';
  icon.textContent = it.dir ? '📁' : '📄';
  const name = document.createElement('span');
  name.className = 'tname';
  name.textContent = it.name;
  wrap.appendChild(arrow);
  wrap.appendChild(icon);
  wrap.appendChild(name);
  if (!it.dir) {
    const sz = document.createElement('span');
    sz.className = 'tsize';
    sz.textContent = fmtSize(it.size);
    wrap.appendChild(sz);
  }
  wrap.style.paddingLeft = (parentRel ? (parentRel.split('/').length) * 16 : 0) + 8 + 'px';

  if (it.dir) {
    const childBox = document.createElement('div');
    childBox.style.display = expandedDirs[rel] ? 'block' : 'none';
    wrap.appendChild(childBox);
    wrap.onclick = async (ev) => {
      ev.stopPropagation();
      const isOpen = childBox.style.display !== 'none';
      childBox.style.display = isOpen ? 'none' : 'block';
      arrow.textContent = isOpen ? '▶' : '▼';
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
      ev.stopPropagation();
      document.querySelectorAll('#tree .tnode.sel').forEach(n => n.classList.remove('sel'));
      wrap.classList.add('sel');
      openFile(rel, it.name);
    };
  }
  return wrap;
}

// ================= 编辑器 =================
// 自维护撤销/重做历史栈（比 execCommand 可靠）
let history = [];
let historyIdx = -1;
let suppressHistory = false;

function snapshot() {
  history = history.slice(0, historyIdx + 1);
  history.push($('editor').value);
  if (history.length > 100) history.shift();
  historyIdx = history.length - 1;
}

async function openFile(rel, name) {
  const r = await window.dsh.fsRead(rel);
  if (!r.ok) {
    $('editor').value = '';
    $('contentName').textContent = '打开失败';
    $('editorPath').textContent = rel;
    $('editorDirty').textContent = r.error;
    return;
  }
  currentFile = { rel, name };
  dirty = false;
  history = [r.content];
  historyIdx = 0;
  $('editor').value = r.content;
  $('contentName').textContent = name;
  $('editorPath').textContent = rel;
  $('editorDirty').textContent = '';
  $('content-pane').classList.add('open');
  $('editor').focus();
}

function markDirty() {
  if (!currentFile) return;
  dirty = true;
  $('editorDirty').textContent = '● 未保存';
  $('editorDirty').className = 'dirty';
}

$('editor').addEventListener('input', () => {
  markDirty();
  if (!suppressHistory) snapshot();
});

function applyHistory() {
  suppressHistory = true;
  $('editor').value = history[historyIdx];
  suppressHistory = false;
  markDirty();
  $('editor').focus();
}

$('btnUndo').onclick = () => {
  if (historyIdx > 0) { historyIdx--; applyHistory(); }
};
$('btnRedo').onclick = () => {
  if (historyIdx < history.length - 1) { historyIdx++; applyHistory(); }
};

$('btnSave').onclick = async () => {
  if (!currentFile) return;
  const btn = $('btnSave');
  btn.disabled = true;
  const r = await window.dsh.fsWrite(currentFile.rel, $('editor').value);
  btn.disabled = false;
  if (r.ok) {
    dirty = false;
    $('editorDirty').textContent = '已保存 ' + new Date().toLocaleTimeString();
    $('editorDirty').className = '';
    loadTree(); // 刷新树（大小变化）
  } else {
    $('editorDirty').textContent = '保存失败：' + r.error;
    $('editorDirty').className = 'dirty';
  }
};

// 撤销 / 重做（自维护历史栈）
$('btnUndo').onclick = () => {
  if (historyIdx > 0) { historyIdx--; applyHistory(); }
};
$('btnRedo').onclick = () => {
  if (historyIdx < history.length - 1) { historyIdx++; applyHistory(); }
};

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 's' && currentFile) {
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

$('btnNewFile').onclick = () => promptNewFile('');
$('btnNewDir').onclick = () => promptNewDir('');

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
  const parentRel = isDir ? rel : (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
  ctxTarget = parentRel ? { rel: parentRel, dir: true } : null;
  const items = [];
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
  if (!confirm('确定删除「' + rel + '」' + (isDir ? ' 及其全部内容' : '') + ' 吗？此操作不可恢复！')) return;
  const r = await window.dsh.fsDelete(rel);
  if (!r.ok) { alert('删除失败：' + r.error); return; }
  if (currentFile && currentFile.rel === rel) {
    currentFile = null;
    $('content-pane').classList.remove('open');
    $('contentName').textContent = '未打开文件';
    $('editor').value = '';
    $('editorPath').textContent = '';
    $('editorDirty').textContent = '';
  }
  loadTree();
}

// 主进程启动服务后页面就绪
window.dsh.isMaximized().then(() => { }).catch(() => { });
start();
