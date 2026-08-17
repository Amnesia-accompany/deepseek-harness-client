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
  if (v === 'files') loadTree();
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

$('treeRefresh').onclick = () => loadTree();

// 主进程启动服务后页面就绪
window.dsh.isMaximized().then(() => { }).catch(() => { });
start();
