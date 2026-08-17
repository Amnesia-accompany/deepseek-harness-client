// ============================================================
//  DeepSeek Harness 客户端 - 安装界面（可爱现代风）
//  InstallerUI.cs
//  包含：圆角按钮/圆角卡片/圆角进度条/步骤徽章/渐变背景
//  依赖：InstallerLogic（Installer.cs），嵌入资源 DSHLogo.png
// ============================================================
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace DSHInstaller {

    // ---------- 圆角工具 ----------
    static class Rounded {
        public static GraphicsPath Path(Rectangle r, int radius) {
            int d = radius * 2;
            GraphicsPath p = new GraphicsPath();
            if (d >= r.Width || d >= r.Height) {
                p.AddRectangle(r);
                return p;
            }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }
    }

    // ---------- 圆角按钮 ----------
    class RoundedButton : Button {
        public int Radius = 12;
        public Color HoverColor = Color.Empty;
        bool hovering;

        public RoundedButton() {
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
        }

        protected override void OnMouseEnter(EventArgs e) { hovering = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hovering = false; Invalidate(); base.OnMouseLeave(e); }

        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            Color back = BackColor;
            if (!Enabled) back = Color.FromArgb(198, 210, 228);
            else if (hovering && HoverColor != Color.Empty) back = HoverColor;
            using (GraphicsPath p = Rounded.Path(rect, Radius)) {
                using (SolidBrush b = new SolidBrush(back)) e.Graphics.FillPath(b, p);
            }
            TextRenderer.DrawText(e.Graphics, Text, Font, rect,
                Enabled ? ForeColor : Color.FromArgb(255, 255, 255),
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
    }

    // ---------- 圆角卡片容器 ----------
    class RoundedCard : Panel {
        public int Radius = 14;
        public Color BorderColor = Color.FromArgb(214, 232, 255);

        public RoundedCard() {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath p = Rounded.Path(rect, Radius)) {
                using (SolidBrush b = new SolidBrush(Color.White)) e.Graphics.FillPath(b, p);
                using (Pen pen = new Pen(BorderColor)) e.Graphics.DrawPath(pen, p);
            }
            // 顶部小标题
            if (!string.IsNullOrEmpty(Text)) {
                using (SolidBrush tb = new SolidBrush(Color.FromArgb(120, 136, 165))) {
                    e.Graphics.DrawString(Text, Font, tb, 16, 10);
                }
            }
        }
    }

    // ---------- 圆角进度条 ----------
    class RoundedProgressBar : Control {
        int value;
        int maximum = 100;
        bool marquee;
        Timer marqueeTimer;
        int marqueeOffset;

        public int Value {
            get { return value; }
            set { this.value = Math.Max(0, Math.Min(maximum, value)); Invalidate(); }
        }
        public int Maximum { get { return maximum; } set { maximum = Math.Max(1, value); Invalidate(); } }
        public bool IsMarquee {
            get { return marquee; }
            set {
                marquee = value;
                if (marquee) {
                    if (marqueeTimer == null) {
                        marqueeTimer = new Timer();
                        marqueeTimer.Interval = 60;
                        marqueeTimer.Tick += delegate { marqueeOffset = (marqueeOffset + 6) % 200; Invalidate(); };
                    }
                    marqueeTimer.Start();
                }
                else if (marqueeTimer != null) marqueeTimer.Stop();
                Invalidate();
            }
        }

        public RoundedProgressBar() {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle track = new Rectangle(0, 1, Width - 1, Height - 3);
            using (GraphicsPath p = Rounded.Path(track, track.Height / 2)) {
                using (SolidBrush b = new SolidBrush(Color.FromArgb(222, 236, 255))) e.Graphics.FillPath(b, p);
            }
            int fillW;
            if (marquee) {
                fillW = Math.Max(60, Width / 3);
                int x = marqueeOffset - fillW;
                if (x > Width) x = marqueeOffset - fillW - 200;
                using (GraphicsPath p = Rounded.Path(new Rectangle(x, 1, fillW, Height - 3), (Height - 3) / 2)) {
                    using (LinearGradientBrush b = new LinearGradientBrush(new Rectangle(x, 1, fillW, Height - 3),
                        Color.FromArgb(110, 170, 255), Color.FromArgb(46, 124, 246), 0f)) {
                        e.Graphics.FillPath(b, p);
                    }
                }
                return;
            }
            fillW = (int)((float)value / maximum * Width);
            if (fillW > 4) {
                using (GraphicsPath p = Rounded.Path(new Rectangle(0, 1, fillW, Height - 3), (Height - 3) / 2)) {
                    using (LinearGradientBrush b = new LinearGradientBrush(new Rectangle(0, 1, fillW, Height - 3),
                        Color.FromArgb(110, 170, 255), Color.FromArgb(46, 124, 246), 0f)) {
                        e.Graphics.FillPath(b, p);
                    }
                }
            }
        }
    }

    // ---------- 步骤徽章 ----------
    class StepBadge : Control {
        public string StepText = "";
        public int State; // 0 未到 1 当前 2 完成
        public int BadgeNumber = 1;

        public StepBadge() {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle badge = new Rectangle(0, 2, 24, 24);
            Color bc = Color.FromArgb(214, 224, 240);
            if (State == 1) bc = Color.FromArgb(46, 124, 246);
            else if (State == 2) bc = Color.FromArgb(39, 174, 96);
            using (GraphicsPath p = Rounded.Path(badge, 12)) {
                using (SolidBrush b = new SolidBrush(bc)) e.Graphics.FillPath(b, p);
            }
            string mark = State == 2 ? "✓" : BadgeNumber.ToString();
            using (SolidBrush tb = new SolidBrush(Color.White)) {
                e.Graphics.DrawString(mark, new Font(Font.FontFamily, 9F, FontStyle.Bold), tb, badge.X + 5, badge.Y + 3);
            }
            Color tc = State == 0 ? Color.FromArgb(150, 160, 180) : Color.FromArgb(40, 58, 90);
            using (SolidBrush tb = new SolidBrush(tc)) {
                e.Graphics.DrawString(StepText, new Font(Font.FontFamily, 9F), tb, 32, 5);
            }
        }
    }

    // ==================== 安装界面 ====================
    class InstallForm : Form {
        // ---- 无边框拖动 ----
        [DllImport("user32.dll")]
        static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);
        const int WM_NCLBUTTONDOWN = 0xA1;
        const int HTCAPTION = 0x2;

        TextBox txtDir;
        RoundedButton btnBrowse;
        RoundedButton btnInstall;
        RoundedButton btnExit;
        RoundedButton btnClose;
        Label lblNodeStatus;
        CheckBox chkNode;
        CheckBox chkShortcut;
        CheckBox chkLaunch;
        RoundedProgressBar prog;
        Label lblStatus;
        StepBadge[] badges;
        bool hasNode;

        static readonly Color MainBlue = Color.FromArgb(46, 124, 246);
        static readonly Color MainBlueHover = Color.FromArgb(70, 145, 255);
        static readonly Color TitleDark = Color.FromArgb(30, 46, 80);
        static readonly Color TextGray = Color.FromArgb(120, 136, 165);

        static Font UiFont(float size, FontStyle style) {
            try { return new Font("Microsoft YaHei UI", size, style); }
            catch { return new Font(FontFamily.GenericSansSerif, size, style); }
        }

        static Image LoadLogo() {
            try {
                using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("DSHLogo.png")) {
                    if (s != null) return new Bitmap(s);
                }
            }
            catch { }
            return null;
        }

        public InstallForm() {
            Text = "DeepSeek Harness 安装";
            Font = UiFont(9F, FontStyle.Regular);
            ClientSize = new Size(600, 674);
            FormBorderStyle = FormBorderStyle.None;   // 无边框自绘
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            DoubleBuffered = true;

            // ---- 自绘标题栏（拖拽 + 关闭） ----
            MouseDown += OnDragMouseDown;

            btnClose = new RoundedButton();
            btnClose.Text = "✕";
            btnClose.Size = new Size(30, 26);
            btnClose.Location = new Point(ClientSize.Width - 40, 7);
            btnClose.BackColor = Color.Transparent;
            btnClose.ForeColor = Color.FromArgb(90, 105, 130);
            btnClose.HoverColor = Color.FromArgb(231, 76, 60);
            btnClose.Font = UiFont(9F, FontStyle.Regular);
            btnClose.Click += delegate { Close(); };
            Controls.Add(btnClose);

            Label barTitle = new Label();
            barTitle.Text = "  DeepSeek Harness 安装";
            barTitle.ForeColor = Color.FromArgb(70, 85, 110);
            barTitle.Font = UiFont(9F, FontStyle.Regular);
            barTitle.AutoSize = true;
            barTitle.Location = new Point(14, 9);
            Controls.Add(barTitle);

            // ---- 大肥鱼圆形头像 ----
            PictureBox logo = new PictureBox();
            logo.SizeMode = PictureBoxSizeMode.Zoom;
            logo.Size = new Size(104, 104);
            logo.Location = new Point((ClientSize.Width - 104) / 2, 52);
            Image logoImg = LoadLogo();
            if (logoImg != null) logo.Image = logoImg;
            Controls.Add(logo);

            // ---- 标题 ----
            Label title = new Label();
            title.Text = "DeepSeek Harness";
            title.Font = UiFont(19F, FontStyle.Bold);
            title.ForeColor = TitleDark;
            title.AutoSize = true;
            title.Location = new Point((ClientSize.Width - title.PreferredWidth) / 2, 168);
            Controls.Add(title);

            Label sub = new Label();
            sub.Text = "蓝色大肥鱼版 · 一键安装";
            sub.Font = UiFont(9.5F, FontStyle.Regular);
            sub.ForeColor = TextGray;
            sub.AutoSize = true;
            sub.Location = new Point((ClientSize.Width - sub.PreferredWidth) / 2, 202);
            Controls.Add(sub);

            // ---- 卡片：安装位置 ----
            RoundedCard card1 = new RoundedCard();
            card1.Text = "安装位置";
            card1.Font = UiFont(8.5F, FontStyle.Regular);
            card1.Location = new Point(32, 238);
            card1.Size = new Size(536, 68);
            Controls.Add(card1);

            txtDir = new TextBox();
            txtDir.Text = InstallerLogic.DefaultDir();
            txtDir.Location = new Point(18, 34);
            txtDir.Size = new Size(398, 24);
            txtDir.BorderStyle = BorderStyle.FixedSingle;
            card1.Controls.Add(txtDir);

            btnBrowse = new RoundedButton();
            btnBrowse.Text = "浏览";
            btnBrowse.Size = new Size(86, 26);
            btnBrowse.Location = new Point(430, 33);
            btnBrowse.BackColor = Color.FromArgb(232, 242, 255);
            btnBrowse.ForeColor = MainBlue;
            btnBrowse.HoverColor = Color.FromArgb(214, 232, 255);
            btnBrowse.Font = UiFont(9F, FontStyle.Regular);
            btnBrowse.Click += delegate {
                using (FolderBrowserDialog d = new FolderBrowserDialog()) {
                    d.Description = "选择安装位置";
                    if (txtDir.Text.Length > 0 && Directory.Exists(txtDir.Text)) d.SelectedPath = txtDir.Text;
                    if (d.ShowDialog(this) == DialogResult.OK) txtDir.Text = d.SelectedPath;
                }
            };
            card1.Controls.Add(btnBrowse);

            // ---- 卡片：运行环境检测 ----
            RoundedCard card2 = new RoundedCard();
            card2.Text = "运行环境检测";
            card2.Font = UiFont(8.5F, FontStyle.Regular);
            card2.Location = new Point(32, 318);
            card2.Size = new Size(536, 96);
            Controls.Add(card2);

            lblNodeStatus = new Label();
            lblNodeStatus.Location = new Point(18, 34);
            lblNodeStatus.AutoSize = true;
            lblNodeStatus.Font = UiFont(9.5F, FontStyle.Bold);
            lblNodeStatus.Text = "检测中...";
            card2.Controls.Add(lblNodeStatus);

            chkNode = new CheckBox();
            chkNode.Text = "安装 Node.js（未检测到，将自动下载约 35MB）";
            chkNode.Location = new Point(18, 64);
            chkNode.AutoSize = true;
            chkNode.Checked = true;
            chkNode.ForeColor = TextGray;
            card2.Controls.Add(chkNode);

            // ---- 卡片：安装选项 ----
            RoundedCard card3 = new RoundedCard();
            card3.Text = "安装选项";
            card3.Font = UiFont(8.5F, FontStyle.Regular);
            card3.Location = new Point(32, 426);
            card3.Size = new Size(536, 88);
            Controls.Add(card3);

            chkShortcut = new CheckBox();
            chkShortcut.Text = "添加桌面快捷方式";
            chkShortcut.Location = new Point(18, 34);
            chkShortcut.AutoSize = true;
            chkShortcut.Checked = true;
            chkShortcut.ForeColor = TextGray;
            card3.Controls.Add(chkShortcut);

            chkLaunch = new CheckBox();
            chkLaunch.Text = "安装完成后直接打开";
            chkLaunch.Location = new Point(18, 62);
            chkLaunch.AutoSize = true;
            chkLaunch.Checked = true;
            chkLaunch.ForeColor = TextGray;
            card3.Controls.Add(chkLaunch);

            // ---- 步骤徽章 ----
            string[] steps = { "解压文件", "运行环境", "安装依赖", "完成" };
            badges = new StepBadge[4];
            for (int i = 0; i < 4; i++) {
                StepBadge sb = new StepBadge();
                sb.StepText = steps[i];
                sb.BadgeNumber = i + 1;
                sb.Size = new Size(120, 28);
                sb.Location = new Point(36 + i * 135, 526);
                sb.Font = UiFont(9F, FontStyle.Regular);
                badges[i] = sb;
                Controls.Add(sb);
            }

            // ---- 进度条 ----
            prog = new RoundedProgressBar();
            prog.Location = new Point(36, 562);
            prog.Size = new Size(528, 14);
            prog.Maximum = 100;
            Controls.Add(prog);

            // ---- 状态 ----
            lblStatus = new Label();
            lblStatus.Location = new Point(36, 584);
            lblStatus.Size = new Size(528, 22);
            lblStatus.ForeColor = TextGray;
            lblStatus.Font = UiFont(8.5F, FontStyle.Regular);
            lblStatus.TextAlign = ContentAlignment.MiddleLeft;
            Controls.Add(lblStatus);

            // ---- 按钮 ----
            btnInstall = new RoundedButton();
            btnInstall.Text = "开 始 安 装";
            btnInstall.Size = new Size(170, 44);
            btnInstall.Location = new Point(182, 614);
            btnInstall.BackColor = MainBlue;
            btnInstall.ForeColor = Color.White;
            btnInstall.HoverColor = MainBlueHover;
            btnInstall.Font = UiFont(11F, FontStyle.Bold);
            btnInstall.Click += StartInstall;
            Controls.Add(btnInstall);

            btnExit = new RoundedButton();
            btnExit.Text = "取 消";
            btnExit.Size = new Size(96, 44);
            btnExit.Location = new Point(368, 614);
            btnExit.BackColor = Color.FromArgb(236, 242, 250);
            btnExit.ForeColor = Color.FromArgb(90, 105, 130);
            btnExit.HoverColor = Color.FromArgb(224, 232, 244);
            btnExit.Font = UiFont(10F, FontStyle.Regular);
            btnExit.Click += delegate { Close(); };
            Controls.Add(btnExit);

            Shown += delegate { BeginInvoke((Action)DetectNode); };
        }

        void OnDragMouseDown(object sender, MouseEventArgs e) {
            if (e.Button == MouseButtons.Left && e.Y < 36) {
                ReleaseCapture();
                SendMessage(Handle, WM_NCLBUTTONDOWN, (IntPtr)HTCAPTION, IntPtr.Zero);
            }
        }

        // 渐变背景
        protected override void OnPaintBackground(PaintEventArgs e) {
            using (LinearGradientBrush b = new LinearGradientBrush(ClientRectangle,
                Color.FromArgb(232, 243, 255), Color.FromArgb(252, 254, 255), 90f)) {
                e.Graphics.FillRectangle(b, ClientRectangle);
            }
        }

        // 更新步骤徽章：current = 当前步骤（0-3）
        void SetStep(int current) {
            for (int i = 0; i < badges.Length; i++) {
                badges[i].State = i < current ? 2 : (i == current ? 1 : 0);
                badges[i].Invalidate();
            }
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
                        lblNodeStatus.ForeColor = Color.FromArgb(39, 174, 96);
                        chkNode.Visible = false;
                        return;
                    }
                }
            }
            catch { }
            hasNode = false;
            lblNodeStatus.Text = "✘ 未检测到 Node.js";
            lblNodeStatus.ForeColor = Color.FromArgb(231, 76, 60);
            chkNode.Visible = true;
            chkNode.Checked = true;
        }

        void SetStatus(string msg) { lblStatus.Text = msg; }

        void SafeStatus(string msg) {
            if (IsDisposed) return;
            if (InvokeRequired) {
                try { BeginInvoke((Action)(delegate { SetStatus(msg); })); }
                catch { }
            }
            else SetStatus(msg);
        }

        void HandleProgress(string m) {
            SetStatus(m);
            Match me = Regex.Match(m, @"解压客户端文件\.\.\.\s*(\d+)\s*/\s*(\d+)");
            if (me.Success) {
                SetStep(0);
                int cur = int.Parse(me.Groups[1].Value);
                int total = int.Parse(me.Groups[2].Value);
                if (total > 0) { prog.IsMarquee = false; prog.Value = Math.Min(99, cur * 100 / total); }
                return;
            }
            Match md = Regex.Match(m, @"下载 Node\.js\s*(\d+)%");
            if (md.Success) {
                SetStep(1);
                prog.IsMarquee = false;
                prog.Value = Math.Min(99, int.Parse(md.Groups[1].Value));
                return;
            }
            if (m.Contains("Node.js") && m.Contains("安装完成")) {
                SetStep(1);
                prog.IsMarquee = false;
                prog.Value = 99;
                return;
            }
            if (m.Contains("正在安装 DeepSeek Harness 核心")) {
                SetStep(2);
                prog.IsMarquee = true;
                return;
            }
            if (m.Contains("安装完成")) {
                SetStep(3);
                prog.IsMarquee = false;
                prog.Value = 100;
                return;
            }
            if (m.Contains("准备安装")) {
                SetStep(0);
                prog.IsMarquee = true;
            }
        }

        void StartInstall(object sender, EventArgs e) {
            string dir = txtDir.Text.Trim().Trim('"');
            if (dir.Length == 0) { MessageBox.Show(this, "请先选择安装位置", "DeepSeek Harness 安装"); return; }
            btnInstall.Enabled = false;
            btnBrowse.Enabled = false;
            prog.Value = 0;
            prog.IsMarquee = true;
            SetStep(0);
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
                if (m != null) HandleProgress(m);
            };
            bw.RunWorkerCompleted += delegate(object s, RunWorkerCompletedEventArgs e2) {
                btnInstall.Enabled = true;
                btnBrowse.Enabled = true;
                prog.IsMarquee = false;
                if (e2.Error != null) {
                    SetStatus("安装失败：" + e2.Error.Message);
                    MessageBox.Show(this,
                        "安装失败：\n" + e2.Error.Message + "\n\n请检查网络后重试。",
                        "DeepSeek Harness 安装", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                else {
                    SetStatus("安装完成！");
                    prog.Value = 100;
                    if (chkLaunch.Checked) {
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
