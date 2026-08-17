// ============================================================
//  蓝色大肥鱼 DeepSeek Harness 懒人客户端 - 启动器（浏览器模式）
//  Launcher.cs
//  ------------------------------------------------------------
//  功能：
//   - 双击即启动：隐藏窗口调用 dsh-client.ps1
//   - 首次使用：自动检测 API Key，缺失时弹出输入框引导填写
//   - 显示启动状态小窗，服务就绪后自动打开浏览器并关闭
//   - 尊重 DSH_HOME 环境变量（检测 Key / 传给脚本）
//  注意：主入口是 desktop.exe（独立窗口客户端），
//        本启动器作为 WebView2 不可用时的浏览器模式备选。
// ============================================================
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace DSHLauncher {
    static class Program {
        [STAThread]
        static int Main(string[] args) {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            string dir = Path.GetDirectoryName(Application.ExecutablePath);

            string dshBin = Path.Combine(dir, "app", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
            bool hasDsh = File.Exists(dshBin);

            string home = Environment.GetEnvironmentVariable("DSH_HOME");
            if (string.IsNullOrEmpty(home)) {
                home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".dsh");
            }
            bool hasKey = false;
            try {
                string credFile = Path.Combine(home, ".credentials.yaml");
                if (File.Exists(credFile)) {
                    foreach (string line in File.ReadAllLines(credFile)) {
                        if (Regex.IsMatch(line, @"^\s*DEEPSEEK_API_KEY\s*:\s*\S")) { hasKey = true; break; }
                    }
                }
            }
            catch { }

            string key = "";
            string mode = "launch";
            if (!hasDsh || !hasKey) {
                key = InputBox("首次使用",
                    "请输入你的 DeepSeek API Key\n（在 platform.deepseek.com 申请，形如 sk-xxxx）：");
                if (key == null) return 0; // 用户取消
                key = key.Trim();
                if (key.Length == 0) {
                    MessageBox.Show("API Key 不能为空", "蓝色大肥鱼",
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return 0;
                }
                mode = hasDsh ? "reconfig" : "install";
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SplashForm(dir, mode, key));
            return 0;
        }

        static string InputBox(string title, string prompt) {
            Form f = new Form();
            f.Text = title;
            f.FormBorderStyle = FormBorderStyle.FixedDialog;
            f.StartPosition = FormStartPosition.CenterScreen;
            f.ClientSize = new Size(480, 150);
            f.MaximizeBox = false;
            f.MinimizeBox = false;
            try { f.Font = new Font("Microsoft YaHei UI", 9F); }
            catch { }

            Label l = new Label();
            l.Text = prompt;
            l.Location = new Point(16, 14);
            l.Size = new Size(448, 48);

            TextBox t = new TextBox();
            t.Location = new Point(16, 70);
            t.Size = new Size(448, 24);

            Button ok = new Button();
            ok.Text = "确定";
            ok.DialogResult = DialogResult.OK;
            ok.Location = new Point(280, 106);
            ok.Size = new Size(90, 30);

            Button cancel = new Button();
            cancel.Text = "取消";
            cancel.DialogResult = DialogResult.Cancel;
            cancel.Location = new Point(374, 106);
            cancel.Size = new Size(90, 30);

            f.Controls.Add(l);
            f.Controls.Add(t);
            f.Controls.Add(ok);
            f.Controls.Add(cancel);
            f.AcceptButton = ok;
            f.CancelButton = cancel;
            f.Shown += delegate { t.Focus(); };

            if (f.ShowDialog() == DialogResult.OK) return t.Text;
            return null;
        }
    }

    class SplashForm : Form {
        Timer timer;
        Timer closeTimer;
        Label lblStatus;
        string dir;
        string mode;
        string key;
        DateTime deadline;
        bool failed;

        public SplashForm(string dir, string mode, string key) {
            this.dir = dir;
            this.mode = mode;
            this.key = key;

            Text = "DeepSeek Harness";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(340, 140);
            BackColor = Color.FromArgb(28, 40, 66);
            ShowInTaskbar = false;

            PictureBox pic = new PictureBox();
            pic.SizeMode = PictureBoxSizeMode.Zoom;
            pic.Size = new Size(56, 56);
            pic.Location = new Point(18, 20);
            try { pic.Image = Icon.ExtractAssociatedIcon(Application.ExecutablePath).ToBitmap(); }
            catch { }

            Label title = new Label();
            title.Text = "DeepSeek Harness";
            title.ForeColor = Color.White;
            try { title.Font = new Font("Microsoft YaHei UI", 13F, FontStyle.Bold); }
            catch { }
            title.AutoSize = true;
            title.Location = new Point(88, 26);

            lblStatus = new Label();
            lblStatus.ForeColor = Color.LightGray;
            lblStatus.Location = new Point(88, 62);
            lblStatus.AutoSize = true;
            try { lblStatus.Font = new Font("Microsoft YaHei UI", 9F); }
            catch { }
            lblStatus.Text = (mode == "install")
                ? "首次启动，正在准备（约 1~3 分钟）..."
                : "正在启动服务...";

            Label tip = new Label();
            tip.Text = "服务窗口会单独弹出，浏览器将自动打开";
            tip.ForeColor = Color.FromArgb(150, 160, 180);
            tip.Location = new Point(18, 106);
            tip.AutoSize = true;
            try { tip.Font = new Font("Microsoft YaHei UI", 8.5F); }
            catch { }

            Controls.Add(pic);
            Controls.Add(title);
            Controls.Add(lblStatus);
            Controls.Add(tip);

            timer = new Timer();
            timer.Interval = 500;
            timer.Tick += Tick;

            Shown += delegate {
                timer.Start();
                StartClient();
            };
        }

        void StartClient() {
            string ps1 = Path.Combine(dir, "scripts", "dsh-client.ps1");
            if (!File.Exists(ps1)) { Fail("客户端文件缺失：" + ps1); return; }
            string args = "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\" -Mode " + mode;
            if (key.Length > 0) args += " -ApiKey \"" + key + "\"";
            try {
                Process p = new Process();
                p.StartInfo.FileName = "powershell.exe";
                p.StartInfo.Arguments = args;
                p.StartInfo.WorkingDirectory = dir;
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.CreateNoWindow = true;
                p.StartInfo.WindowStyle = ProcessWindowStyle.Hidden;
                if (!p.Start()) { Fail("启动失败：无法启动 PowerShell"); return; }
            }
            catch (Exception ex) {
                Fail("启动失败：" + ex.Message);
                return;
            }
            deadline = DateTime.Now.AddSeconds(360);
        }

        int ReadPort() {
            int port = 3080;
            try {
                string cfg = Path.Combine(dir, "data", "config.json");
                if (File.Exists(cfg)) {
                    string json = File.ReadAllText(cfg);
                    Match m = Regex.Match(json, "\"port\"\\s*:\\s*(\\d+)");
                    if (m.Success) port = int.Parse(m.Groups[1].Value);
                }
            }
            catch { }
            return port;
        }

        void Tick(object sender, EventArgs e) {
            if (failed) return;
            int port = ReadPort();
            if (PortReady(port)) {
                timer.Stop();
                lblStatus.Text = "服务已启动！";
                try { Process.Start("http://127.0.0.1:" + port); }
                catch { }
                closeTimer = new Timer();
                closeTimer.Interval = 1500;
                closeTimer.Tick += delegate { closeTimer.Stop(); Close(); };
                closeTimer.Start();
            }
            else if (DateTime.Now > deadline) {
                timer.Stop();
                MessageBox.Show(
                    "服务启动超时。\n请检查弹出的服务窗口中的错误信息（例如 API Key 无效、端口被占用）。",
                    "蓝色大肥鱼", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Close();
            }
        }

        bool PortReady(int port) {
            TcpClient c = new TcpClient();
            try {
                IAsyncResult ar = c.BeginConnect("127.0.0.1", port, null, null);
                if (!ar.AsyncWaitHandle.WaitOne(400)) { c.Close(); return false; }
                c.EndConnect(ar);
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/");
                req.Timeout = 1500;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse()) {
                    bool ok = (resp.StatusCode == HttpStatusCode.OK);
                    c.Close();
                    return ok;
                }
            }
            catch {
                try { c.Close(); }
                catch { }
                return false;
            }
        }

        void Fail(string msg) {
            failed = true;
            timer.Stop();
            MessageBox.Show(msg, "蓝色大肥鱼", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }
}
