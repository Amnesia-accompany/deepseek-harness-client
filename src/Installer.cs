// ============================================================
//  蓝色大肥鱼 DeepSeek Harness 懒人客户端 - 安装器
//  Installer.cs
//  ------------------------------------------------------------
//  功能：
//   - GUI 安装向导：选择安装位置、自动检测 Node.js、
//     未检测到时提供"☑ 安装 Node.js"复选框（默认勾选）
//   - 自动解压客户端、下载安装 Node.js（可选）、
//     用 npm 预装 DeepSeek Harness 依赖（进度显示）
//   - 创建桌面快捷方式、注册 HKCU 卸载项
//   - 静默模式：/S [/DIR=路径] [/NODE=y|n] [/NOSHORTCUT]
//  编译（嵌入 DSHPayload.zip 资源）：
//   csc /target:winexe /resource:payload.zip,DSHPayload.zip ...
// ============================================================
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Management;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Win32;

namespace DSHInstaller {
    static class Program {
        [STAThread]
        static int Main(string[] args) {
            string dir = "";
            bool silent = false;
            bool skipShortcut = false;
            bool? nodeOpt = null;
            foreach (string a in args) {
                string t = (a ?? "").Trim();
                if (t == "/S" || t == "/s" || t == "-S" || t == "-s") { silent = true; }
                else if (t.StartsWith("/DIR=", StringComparison.OrdinalIgnoreCase)) { dir = t.Substring(5).Trim().Trim('"'); }
                else if (t.StartsWith("/NODE=", StringComparison.OrdinalIgnoreCase)) {
                    string v = t.Substring(6).Trim().ToLowerInvariant();
                    nodeOpt = (v == "y" || v == "1" || v == "yes" || v == "true");
                }
                else if (t == "/NOSHORTCUT" || t == "/SKIPSHORTCUT") { skipShortcut = true; }
            }
            if (silent) {
                try {
                    InstallerLogic.Run(dir, nodeOpt, !skipShortcut, null);
                    return 0;
                }
                catch (Exception ex) {
                    try {
                        File.AppendAllText(Path.Combine(Path.GetTempPath(), "dsh-install.log"),
                            DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + ex + "\r\n");
                    }
                    catch { }
                    return 1;
                }
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallForm());
            return 0;
        }
    }

    static class InstallerLogic {
        public static string DefaultDir() {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "DeepSeek Harness");
        }

        // ---------- Node.js 检测 ----------
        public static bool NodeVersionOk(string exe) {
            return NodeVersion(exe).Length > 0;
        }

        public static string NodeVersion(string exe) {
            try {
                Process p = new Process();
                p.StartInfo.FileName = exe;
                p.StartInfo.Arguments = "-v";
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.RedirectStandardOutput = true;
                p.StartInfo.CreateNoWindow = true;
                if (!p.Start()) return "";
                string v = p.StandardOutput.ReadToEnd().Trim();
                p.WaitForExit(5000);
                Match m = Regex.Match(v, @"v(\d+)\.\d+");
                if (!m.Success) return "";
                int major = int.Parse(m.Groups[1].Value);
                if (major < 20) return "";
                return v;
            }
            catch { return ""; }
        }

        public static string FindSystemNode() {
            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string part in path.Split(';')) {
                string p = (part ?? "").Trim().Trim('"');
                if (p.Length == 0) continue;
                try {
                    string exe = Path.Combine(p, "node.exe");
                    if (File.Exists(exe)) {
                        string v = NodeVersion(exe);
                        if (v.Length > 0) return exe;
                    }
                }
                catch { }
            }
            try {
                string pf = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    "nodejs", "node.exe");
                if (File.Exists(pf)) {
                    string v = NodeVersion(pf);
                    if (v.Length > 0) return pf;
                }
            }
            catch { }
            return null;
        }

        // ---------- 停止客户端服务进程 ----------
        public static void KillClientServers() {
            try {
                ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'node.exe'");
                foreach (ManagementObject mo in searcher.Get()) {
                    try {
                        string cmdline = Convert.ToString(mo["CommandLine"]) ?? "";
                        if (cmdline.IndexOf(@"dsh\lib\bin.js", StringComparison.OrdinalIgnoreCase) < 0) continue;
                        if (cmdline.IndexOf("npm-cache", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                        if (cmdline.IndexOf("npx", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                        uint pid = Convert.ToUInt32(mo["ProcessId"]);
                        try { Process.GetProcessById((int)pid).Kill(); } catch { }
                    }
                    catch { }
                }
            }
            catch { }
        }

        // ---------- 下载 Node.js（便携版，免管理员） ----------
        static string DownloadNode(string targetDir, Action<string> progress) {
            string[] mirrors = { "https://npmmirror.com/mirrors/node", "https://nodejs.org/dist" };
            string mirror = null;
            string json = null;
            using (WebClient wc = new WebClient()) {
                wc.Encoding = Encoding.UTF8;
                foreach (string m in mirrors) {
                    try { json = wc.DownloadString(m + "/index.json"); mirror = m; break; }
                    catch { }
                }
            }
            if (mirror == null || json == null) throw new Exception("无法获取 Node.js 版本信息，请检查网络后重试");
            string ver = null;
            Regex re = new Regex("\"version\":\"(v\\d+\\.\\d+\\.\\d+)\".*?\"lts\":(?:false|\\\"([A-Za-z]+)\\\")", RegexOptions.Singleline);
            foreach (Match m in re.Matches(json)) {
                if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) { ver = m.Groups[1].Value; break; }
            }
            if (ver == null) throw new Exception("无法确定 Node.js LTS 版本");
            string zipName = "node-" + ver + "-win-x64.zip";
            string zipPath = Path.Combine(Path.GetTempPath(), zipName);
            using (WebClient wc = new WebClient()) {
                wc.DownloadFile(mirror + "/" + ver + "/" + zipName, zipPath);
            }
            string tmp = Path.Combine(targetDir, "tools", "node-tmp");
            if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
            ZipFile.ExtractToDirectory(zipPath, tmp);
            string inner = Path.Combine(tmp, "node-" + ver + "-win-x64");
            string dest = Path.Combine(targetDir, "tools", "node");
            if (Directory.Exists(dest)) Directory.Delete(dest, true);
            Directory.Move(inner, dest);
            try { Directory.Delete(tmp, true); } catch { }
            try { File.Delete(zipPath); } catch { }
            return Path.Combine(dest, "node.exe");
        }

        // ---------- 运行进程并回传输出 ----------
        public static int RunProcess(string file, string args, string workDir, Action<string> line) {
            Process p = new Process();
            p.StartInfo.FileName = file;
            p.StartInfo.Arguments = args;
            if (workDir != null && workDir.Length > 0) p.StartInfo.WorkingDirectory = workDir;
            p.StartInfo.UseShellExecute = false;
            p.StartInfo.RedirectStandardOutput = true;
            p.StartInfo.RedirectStandardError = true;
            p.StartInfo.CreateNoWindow = true;
            p.OutputDataReceived += delegate(object s, DataReceivedEventArgs e) {
                if (!String.IsNullOrEmpty(e.Data) && line != null) line(e.Data);
            };
            p.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e) {
                if (!String.IsNullOrEmpty(e.Data) && line != null) line(e.Data);
            };
            p.Start();
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            p.WaitForExit();
            return p.ExitCode;
        }

        // ---------- npm 安装依赖 ----------
        static void NpmInstall(string targetDir, string nodeExe, Action<string> progress) {
            string appDir = Path.Combine(targetDir, "app");
            string npmCli = Path.Combine(Path.GetDirectoryName(nodeExe), "node_modules", "npm", "bin", "npm-cli.js");
            if (!File.Exists(npmCli)) throw new Exception("未找到 npm 组件：" + npmCli);
            string[] registries = { "https://registry.npmmirror.com", "https://registry.npmjs.org" };
            bool ok = false;
            foreach (string reg in registries) {
                if (progress != null) progress("使用镜像源 " + reg);
                int code = RunProcess(nodeExe,
                    "\"" + npmCli + "\" install --registry " + reg + " --no-audit --no-fund --loglevel=error",
                    appDir, progress);
                if (code == 0) { ok = true; break; }
            }
            if (!ok) throw new Exception("DeepSeek Harness 依赖安装失败，请检查网络后重试");
        }

        // ---------- 解压嵌入的客户端载荷 ----------
        static void ExtractPayload(string targetDir, Action<string> progress) {
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("DSHPayload.zip")) {
                if (s == null) throw new Exception("安装包数据缺失，请重新下载安装程序");
                using (ZipArchive za = new ZipArchive(s, ZipArchiveMode.Read)) {
                    int total = za.Entries.Count;
                    int i = 0;
                    foreach (ZipArchiveEntry e in za.Entries) {
                        i++;
                        if (progress != null && (i % 300 == 0 || i == total)) {
                            progress("正在解压客户端文件... " + i + " / " + total);
                        }
                        string name = e.FullName.Replace('/', Path.DirectorySeparatorChar);
                        string dest = Path.Combine(targetDir, name);
                        if (name.EndsWith(Path.DirectorySeparatorChar.ToString()) || name.Length == 0) {
                            Directory.CreateDirectory(dest);
                            continue;
                        }
                        Directory.CreateDirectory(Path.GetDirectoryName(dest));
                        using (Stream src = e.Open())
                        using (FileStream fs = File.Create(dest)) {
                            src.CopyTo(fs);
                        }
                    }
                }
            }
        }

        // ---------- 桌面快捷方式 ----------
        public static void CreateShortcut(string targetDir) {
            try {
                Type t = Type.GetTypeFromProgID("WScript.Shell");
                if (t == null) return;
                dynamic shell = Activator.CreateInstance(t);
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                dynamic lnk = shell.CreateShortcut(Path.Combine(desktop, "DeepSeek Harness.lnk"));
                lnk.TargetPath = Path.Combine(targetDir, "蓝色大肥鱼DSH.exe");
                lnk.WorkingDirectory = targetDir;
                lnk.IconLocation = Path.Combine(targetDir, "蓝色大肥鱼DSH.exe");
                lnk.Description = "蓝色大肥鱼 - DeepSeek Harness 懒人客户端";
                lnk.Save();
            }
            catch { }
        }

        // ---------- 注册卸载项（HKCU，免管理员） ----------
        public static void RegisterUninstall(string targetDir) {
            try {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekHarness")) {
                    key.SetValue("DisplayName", "DeepSeek Harness 懒人客户端");
                    key.SetValue("DisplayVersion", "0.1.1");
                    key.SetValue("Publisher", "蓝色大肥鱼");
                    key.SetValue("DisplayIcon", "\"" + Path.Combine(targetDir, "蓝色大肥鱼DSH.exe") + "\"");
                    key.SetValue("UninstallString", "\"" + Path.Combine(targetDir, "uninstaller.exe") + "\"");
                    key.SetValue("InstallLocation", targetDir);
                    key.SetValue("NoModify", 1);
                    key.SetValue("NoRepair", 1);
                }
            }
            catch { }
        }

        // ---------- 主安装流程 ----------
        public static void Run(string targetDir, bool? installNode, bool createShortcut, Action<string> progress) {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            if (string.IsNullOrEmpty(targetDir)) targetDir = DefaultDir();
            targetDir = Path.GetFullPath(targetDir).TrimEnd('\\');
            if (progress != null) progress("准备安装到 " + targetDir);

            // 先停掉正在运行的客户端服务，避免文件占用
            KillClientServers();
            System.Threading.Thread.Sleep(800);

            Directory.CreateDirectory(targetDir);

            // 1. 解压客户端文件
            if (progress != null) progress("正在解压客户端文件...");
            ExtractPayload(targetDir, progress);

            // 2. 确定 Node.js
            string nodeExe = FindSystemNode();
            string toolsNode = Path.Combine(targetDir, "tools", "node", "node.exe");
            if (File.Exists(toolsNode)) {
                string v = NodeVersion(toolsNode);
                if (v.Length > 0) nodeExe = toolsNode;
            }
            bool needNode = (nodeExe == null) && (installNode != false);
            if (nodeExe == null && installNode == false) {
                throw new Exception("未检测到 Node.js 且已取消自动安装，无法继续");
            }
            if (needNode) {
                if (progress != null) progress("正在下载 Node.js（约 35MB，请稍候）...");
                nodeExe = DownloadNode(targetDir, progress);
                if (progress != null) progress("Node.js " + NodeVersion(nodeExe) + " 安装完成");
            }

            // 3. 预装 DeepSeek Harness 依赖
            if (progress != null) progress("正在安装 DeepSeek Harness 核心（约 1~3 分钟）...");
            NpmInstall(targetDir, nodeExe, progress);

            // 4. 快捷方式与卸载项
            if (createShortcut) CreateShortcut(targetDir);
            RegisterUninstall(targetDir);

            if (progress != null) progress("安装完成！");
        }
    }

    // ==================== 安装界面 ====================
    class InstallForm : Form {
        TextBox txtDir;
        Button btnBrowse;
        Button btnInstall;
        Button btnExit;
        Label lblNodeStatus;
        CheckBox chkNode;
        CheckBox chkShortcut;
        CheckBox chkLaunch;
        ProgressBar prog;
        Label lblStatus;
        bool hasNode;

        static Font UiFont(float size, FontStyle style) {
            try { return new Font("Microsoft YaHei UI", size, style); }
            catch { return new Font(FontFamily.GenericSansSerif, size, style); }
        }

        public InstallForm() {
            Text = "蓝色大肥鱼 - DeepSeek Harness 懒人客户端 安装";
            Font = UiFont(9F, FontStyle.Regular);
            ClientSize = new Size(560, 470);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;

            Label title = new Label();
            title.Text = "蓝色大肥鱼 DeepSeek Harness 懒人客户端";
            title.Font = UiFont(14F, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(0, 110, 215);
            title.AutoSize = true;
            title.Location = new Point(26, 20);

            Label sub = new Label();
            sub.Text = "基于 deepseek-ai/deepseek-harness 开源项目 · 界面与官方一致";
            sub.AutoSize = true;
            sub.ForeColor = Color.Gray;
            sub.Location = new Point(28, 52);

            Label l1 = new Label();
            l1.Text = "安装位置：";
            l1.AutoSize = true;
            l1.Location = new Point(26, 90);

            txtDir = new TextBox();
            txtDir.Text = InstallerLogic.DefaultDir();
            txtDir.Location = new Point(110, 87);
            txtDir.Width = 330;

            btnBrowse = new Button();
            btnBrowse.Text = "浏览...";
            btnBrowse.Location = new Point(446, 86);
            btnBrowse.Size = new Size(88, 25);

            GroupBox grp = new GroupBox();
            grp.Text = "运行环境检测";
            grp.Location = new Point(24, 126);
            grp.Size = new Size(510, 96);

            lblNodeStatus = new Label();
            lblNodeStatus.Location = new Point(14, 26);
            lblNodeStatus.AutoSize = true;
            lblNodeStatus.Font = UiFont(9.5F, FontStyle.Bold);
            lblNodeStatus.Text = "检测中...";

            chkNode = new CheckBox();
            chkNode.Text = "安装 Node.js（未检测到，将自动下载约 35MB）";
            chkNode.Location = new Point(14, 58);
            chkNode.AutoSize = true;
            chkNode.Checked = true;

            grp.Controls.Add(lblNodeStatus);
            grp.Controls.Add(chkNode);

            GroupBox grpOpt = new GroupBox();
            grpOpt.Text = "安装选项";
            grpOpt.Location = new Point(24, 232);
            grpOpt.Size = new Size(510, 86);

            chkShortcut = new CheckBox();
            chkShortcut.Text = "添加桌面快捷方式";
            chkShortcut.Location = new Point(16, 26);
            chkShortcut.AutoSize = true;
            chkShortcut.Checked = true;

            chkLaunch = new CheckBox();
            chkLaunch.Text = "安装完成后直接打开";
            chkLaunch.Location = new Point(16, 56);
            chkLaunch.AutoSize = true;
            chkLaunch.Checked = true;

            grpOpt.Controls.Add(chkShortcut);
            grpOpt.Controls.Add(chkLaunch);

            prog = new ProgressBar();
            prog.Location = new Point(26, 330);
            prog.Size = new Size(508, 20);
            prog.Style = ProgressBarStyle.Continuous;

            lblStatus = new Label();
            lblStatus.Location = new Point(26, 358);
            lblStatus.Size = new Size(508, 40);
            lblStatus.ForeColor = Color.DimGray;

            btnInstall = new Button();
            btnInstall.Text = "安装";
            btnInstall.Location = new Point(330, 410);
            btnInstall.Size = new Size(100, 36);
            btnInstall.BackColor = Color.FromArgb(0, 120, 215);
            btnInstall.ForeColor = Color.White;
            btnInstall.FlatStyle = FlatStyle.Flat;

            btnExit = new Button();
            btnExit.Text = "退出";
            btnExit.Location = new Point(438, 410);
            btnExit.Size = new Size(96, 36);

            Controls.Add(title);
            Controls.Add(sub);
            Controls.Add(l1);
            Controls.Add(txtDir);
            Controls.Add(btnBrowse);
            Controls.Add(grp);
            Controls.Add(grpOpt);
            Controls.Add(prog);
            Controls.Add(lblStatus);
            Controls.Add(btnInstall);
            Controls.Add(btnExit);

            btnBrowse.Click += delegate {
                using (FolderBrowserDialog d = new FolderBrowserDialog()) {
                    d.Description = "选择安装位置";
                    if (txtDir.Text.Length > 0 && Directory.Exists(txtDir.Text)) d.SelectedPath = txtDir.Text;
                    if (d.ShowDialog(this) == DialogResult.OK) txtDir.Text = d.SelectedPath;
                }
            };
            btnInstall.Click += StartInstall;
            btnExit.Click += delegate { Close(); };
            Shown += delegate { BeginInvoke((Action)DetectNode); };
        }

        void DetectNode() {
            try {
                string toolsNode = Path.Combine(txtDir.Text.Trim().Trim('"'), "tools", "node", "node.exe");
                string exe = (File.Exists(toolsNode)) ? toolsNode : InstallerLogic.FindSystemNode();
                if (exe != null) {
                    string v = InstallerLogic.NodeVersion(exe);
                    if (v.Length > 0) {
                        hasNode = true;
                        lblNodeStatus.Text = "✔ 已检测到 Node.js " + v;
                        lblNodeStatus.ForeColor = Color.Green;
                        chkNode.Visible = false;
                        return;
                    }
                }
            }
            catch { }
            hasNode = false;
            lblNodeStatus.Text = "✘ 未检测到 Node.js";
            lblNodeStatus.ForeColor = Color.Red;
            chkNode.Visible = true;
            chkNode.Checked = true;
        }

        void SetStatus(string msg) {
            lblStatus.Text = msg;
        }

        void SafeStatus(string msg) {
            if (IsDisposed) return;
            if (InvokeRequired) {
                try { BeginInvoke((Action)(delegate { SetStatus(msg); })); }
                catch { }
            }
            else SetStatus(msg);
        }

        void StartInstall(object sender, EventArgs e) {
            string dir = txtDir.Text.Trim().Trim('"');
            if (dir.Length == 0) { MessageBox.Show(this, "请先选择安装位置", "蓝色大肥鱼"); return; }
            btnInstall.Enabled = false;
            btnBrowse.Enabled = false;
            prog.Value = 0;
            prog.Style = ProgressBarStyle.Marquee;
            SetStatus("开始安装...");

            BackgroundWorker bw = new BackgroundWorker();
            bw.WorkerReportsProgress = true;
            bw.DoWork += delegate(object s, DoWorkEventArgs e2) {
                InstallerLogic.Run(dir, hasNode ? (bool?)null : chkNode.Checked, chkShortcut.Checked, delegate(string m) {
                    bw.ReportProgress(0, m);
                });
            };
            bw.ProgressChanged += delegate(object s, ProgressChangedEventArgs e2) {
                string m = e2.UserState as string;
                if (m != null) SafeStatus(m);
            };
            bw.RunWorkerCompleted += delegate(object s, RunWorkerCompletedEventArgs e2) {
                btnInstall.Enabled = true;
                btnBrowse.Enabled = true;
                prog.Style = ProgressBarStyle.Continuous;
                if (e2.Error != null) {
                    SetStatus("安装失败：" + e2.Error.Message);
                    MessageBox.Show(this,
                        "安装失败：\n" + e2.Error.Message + "\n\n请检查网络后重试。",
                        "蓝色大肥鱼", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                else {
                    SetStatus("安装完成！");
                    prog.Value = 100;
                    if (chkLaunch.Checked) {
                        // 勾选了"安装完成后直接打开"：直接启动（首次启动会询问 API Key）
                        try { Process.Start(Path.Combine(dir, "蓝色大肥鱼DSH.exe")); }
                        catch { }
                    }
                    Close();
                }
            };
            bw.RunWorkerAsync();
        }
    }
}
