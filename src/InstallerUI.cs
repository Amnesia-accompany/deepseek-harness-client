// ============================================================
//  DeepSeek Harness 客户端 - 安装界面（可爱现代风 v2）
//  InstallerUI.cs
//  包含：圆角按钮(带投影)/圆角卡片(带投影)/圆角进度条(百分比)
//        图标复选框/步骤徽章(连线+光晕)/渐变背景
//  依赖：InstallerLogic（Installer.cs）
//  嵌入资源：DSHLogo.png / DSHIconDesktop.png / DSHIconRocket.png / DSHIconNode.png
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

    // ---------- 资源图标 ----------
    static class IconAssets {
        static Image Load(string name) {
            try {
                using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) {
                    if (s != null) return new Bitmap(s);
                }
            }
            catch { }
            return null;
        }
        static Image desktop, rocket, node, logo;
        public static Image Desktop { get { if (desktop == null) desktop = Load("DSHIconDesktop.png"); return desktop; } }
        public static Image Rocket { get { if (rocket == null) rocket = Load("DSHIconRocket.png"); return rocket; } }
        public static Image Node { get { if (node == null) node = Load("DSHIconNode.png"); return node; } }
        public static Image Logo { get { if (logo == null) logo = Load("DSHLogo.png"); return logo; } }
    }

    // ---------- 圆角按钮（带投影） ----------
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
            // 投影
            using (GraphicsPath sh = Rounded.Path(new Rectangle(0, 2, Width - 1, Height - 1), Radius)) {
                using (SolidBrush sb = new SolidBrush(Color.FromArgb(22, 30, 80, 150))) e.Graphics.FillPath(sb, sh);
            }
            using (GraphicsPath p = Rounded.Path(rect, Radius)) {
                using (SolidBrush b = new SolidBrush(back)) e.Graphics.FillPath(b, p);
            }
            TextRenderer.DrawText(e.Graphics, Text, Font, rect,
                Enabled ? ForeColor : Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
    }

    // ---------- 圆角卡片（带投影） ----------
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
            // 投影
            using (GraphicsPath sh = Rounded.Path(new Rectangle(0, 3, Width - 1, Height - 1), Radius)) {
                using (SolidBrush sb = new SolidBrush(Color.FromArgb(16, 40, 90, 170))) e.Graphics.FillPath(sb, sh);
            }
            using (GraphicsPath p = Rounded.Path(rect, Radius)) {
                using (SolidBrush b = new SolidBrush(Color.White)) e.Graphics.FillPath(b, p);
                using (Pen pen = new Pen(BorderColor)) e.Graphics.DrawPath(pen, p);
            }
            if (!string.IsNullOrEmpty(Text)) {
                using (SolidBrush tb = new SolidBrush(Color.FromArgb(120, 136, 165))) {
                    e.Graphics.DrawString(Text, Font, tb, 16, 10);
                }
            }
        }
    }

    // ---------- 圆角进度条（带百分比） ----------
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
                        marqueeTimer.Interval = 30;
                        marqueeTimer.Tick += delegate { marqueeOffset = (marqueeOffset + 4) % 260; Invalidate(); };
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
            Rectangle track = new Rectangle(0, 2, Width - 1, Height - 5);
            int rad = track.Height / 2;
            using (GraphicsPath p = Rounded.Path(track, rad)) {
                using (SolidBrush b = new SolidBrush(Color.FromArgb(222, 236, 255))) e.Graphics.FillPath(b, p);
            }
            if (marquee) {
                int mw = Math.Max(80, Width / 3);
                int x = marqueeOffset - mw;
                if (x > Width) x = marqueeOffset - mw - 260;
                using (GraphicsPath p = Rounded.Path(new Rectangle(x, 2, mw, Height - 5), rad)) {
                    using (LinearGradientBrush b = new LinearGradientBrush(new Rectangle(x, 2, mw, Height - 5),
                        Color.FromArgb(120, 180, 255), Color.FromArgb(46, 124, 246), 0f)) {
                        e.Graphics.FillPath(b, p);
                    }
                }
                return;
            }
            int fillW = (int)((float)value / maximum * Width);
            if (fillW > 6) {
                using (GraphicsPath p = Rounded.Path(new Rectangle(0, 2, fillW, Height - 5), rad)) {
                    using (LinearGradientBrush b = new LinearGradientBrush(new Rectangle(0, 2, fillW, Height - 5),
                        Color.FromArgb(120, 180, 255), Color.FromArgb(46, 124, 246), 0f)) {
                        e.Graphics.FillPath(b, p);
                    }
                }
            }
            // 百分比文字
            if (!marquee && value > 0 && value < 100) {
                string pct = value + "%";
                SizeF sz = e.Graphics.MeasureString(pct, Font);
                using (SolidBrush tb = new SolidBrush(Color.FromArgb(90, 120, 170))) {
                    e.Graphics.DrawString(pct, Font, tb, Width - sz.Width - 4, 2);
                }
            }
        }
    }

    // ---------- 图标复选框（自绘：勾选框 + 图标 + 文字） ----------
    class IconCheckBox : Control {
        Image icon;
        bool checkedState;
        bool hovering;

        public bool Checked {
            get { return checkedState; }
            set { checkedState = value; Invalidate(); }
        }
        public Image Icon { get { return icon; } set { icon = value; Invalidate(); } }

        public IconCheckBox() {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
            Cursor = Cursors.Hand;
        }

        protected override void OnMouseEnter(EventArgs e) { hovering = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hovering = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnClick(EventArgs e) {
            Checked = !Checked;
            base.OnClick(e);
        }

        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            // 悬停底色
            if (hovering) {
                using (GraphicsPath hp = Rounded.Path(new Rectangle(0, 1, Width - 1, Height - 3), 8)) {
                    using (SolidBrush hb = new SolidBrush(Color.FromArgb(28, 214, 232, 255))) e.Graphics.FillPath(hb, hp);
                }
            }
            // 图标
            if (icon != null) {
                e.Graphics.DrawImage(icon, new Rectangle(6, 5, 20, 20));
            }
            // 勾选框
            Rectangle box = new Rectangle(32, 5, 18, 18);
            using (GraphicsPath bp = Rounded.Path(box, 5)) {
                if (checkedState) {
                    using (SolidBrush bb = new SolidBrush(Color.FromArgb(46, 124, 246))) e.Graphics.FillPath(bb, bp);
                    using (Pen wp = new Pen(Color.White, 2.2f)) {
                        e.Graphics.DrawLine(wp, box.X + 4, box.Y + 9, box.X + 8, box.Y + 13);
                        e.Graphics.DrawLine(wp, box.X + 8, box.Y + 13, box.X + 14, box.Y + 5);
                    }
                }
                else {
                    using (SolidBrush bb = new SolidBrush(Color.White)) e.Graphics.FillPath(bb, bp);
                    using (Pen gp = new Pen(Color.FromArgb(170, 190, 220), 1.4f)) e.Graphics.DrawPath(gp, bp);
                }
            }
            // 文字
            TextRenderer.DrawText(e.Graphics, Text, Font,
                new Rectangle(58, 0, Width - 60, Height),
                Color.FromArgb(60, 75, 105),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
    }

    // ---------- 步骤徽章（连线 + 光晕） ----------
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
            // 连接线（徽章右侧）
            if (BadgeNumber < 4) {
                int lineY = 13;
                Color lc = State == 2 ? Color.FromArgb(39, 174, 96) : Color.FromArgb(214, 224, 240);
                using (Pen lp = new Pen(lc, 2.4f)) {
                    e.Graphics.DrawLine(lp, 28, lineY, Width - 6, lineY);
                }
            }
            Rectangle badge = new Rectangle(0, 1, 26, 26);
            Color bc = Color.FromArgb(214, 224, 240);
            if (State == 1) bc = Color.FromArgb(46, 124, 246);
            else if (State == 2) bc = Color.FromArgb(39, 174, 96);
            // 当前步骤光晕
            if (State == 1) {
                using (GraphicsPath gp = Rounded.Path(new Rectangle(-2, -1, 30, 30), 15)) {
                    using (SolidBrush gb = new SolidBrush(Color.FromArgb(40, 46, 124, 246))) e.Graphics.FillPath(gb, gp);
                }
            }
            using (GraphicsPath p = Rounded.Path(badge, 13)) {
                using (SolidBrush b = new SolidBrush(bc)) e.Graphics.FillPath(b, p);
            }
            string mark = State == 2 ? "✓" : BadgeNumber.ToString();
            using (SolidBrush tb = new SolidBrush(Color.White)) {
                e.Graphics.DrawString(mark, new Font(Font.FontFamily, 9F, FontStyle.Bold), tb, badge.X + 6, badge.Y + 3);
            }
            Color tc = State == 0 ? Color.FromArgb(150, 160, 180) : Color.FromArgb(40, 58, 90);
            using (SolidBrush tb = new SolidBrush(tc)) {
                e.Graphics.DrawString(StepText, new Font(Font.FontFamily, 9F), tb, 34, 5);
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
        IconCheckBox chkNode;
        IconCheckBox chkShortcut;
        IconCheckBox chkLaunch;
        RoundedProgressBar prog;
        Label lblStatus;
        StepBadge[] badges;
        Label title;
        Label sub;
        bool hasNode;

        static readonly Color MainBlue = Color.FromArgb(46, 124, 246);
        static readonly Color MainBlueHover = Color.FromArgb(70, 145, 255);
        static readonly Color TitleDark = Color.FromArgb(30, 46, 80);
        static readonly Color TextGray = Color.FromArgb(120, 136, 165);

        static Font UiFont(float size, FontStyle style) {
            try { return new Font("Microsoft YaHei UI", size, style); }
            catch { return new Font(FontFamily.GenericSansSerif, size, style); }
        }

        // 深蓝色圆形 Logo（渐变深蓝紫圆 + 白色 DSH 文字）
        static Bitmap MakeDarkLogo() {
            Bitmap b = new Bitmap(108, 108);
            Graphics g = Graphics.FromImage(b);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (LinearGradientBrush lb = new LinearGradientBrush(
                new Rectangle(0, 0, 108, 108),
                Color.FromArgb(84, 104, 168), Color.FromArgb(44, 58, 106), 45f)) {
                g.FillEllipse(lb, 0, 0, 108, 108);
            }
            // 顶部高光
            using (SolidBrush hl = new SolidBrush(Color.FromArgb(36, 255, 255, 255))) {
                g.FillEllipse(hl, 10, 8, 88, 30);
            }
            string s = "DSH";
            using (Font f = new Font("Segoe UI", 30F, FontStyle.Bold)) {
                SizeF sz = g.MeasureString(s, f);
                g.DrawString(s, f, Brushes.White, (108 - sz.Width) / 2, (108 - sz.Height) / 2);
            }
            g.Dispose();
            return b;
        }

        public InstallForm() {
            Text = "DeepSeek Harness 安装";
            Font = UiFont(9F, FontStyle.Regular);
            ClientSize = new Size(600, 706);
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

            // ---- 深蓝色圆形 Logo（自绘：渐变深蓝圆 + 白色 DSH） ----
            PictureBox logo = new PictureBox();
            logo.SizeMode = PictureBoxSizeMode.Zoom;
            logo.Size = new Size(108, 108);
            logo.Location = new Point((ClientSize.Width - 108) / 2, 46);
            logo.Image = MakeDarkLogo();
            Controls.Add(logo);

            // ---- 标题（Shown 后居中，避免构造期宽度为 0 导致重叠/偏移） ----
            title = new Label();
            title.Text = "DeepSeek Harness";
            title.Font = UiFont(19F, FontStyle.Bold);
            title.ForeColor = TitleDark;
            title.AutoSize = true;
            title.Location = new Point(0, 168);
            Controls.Add(title);

            sub = new Label();
            sub.Text = "蓝色大肥鱼版 · 一键安装";
            sub.Font = UiFont(9.5F, FontStyle.Regular);
            sub.ForeColor = TextGray;
            sub.AutoSize = true;
            sub.Location = new Point(0, 202);
            Controls.Add(sub);

            // ---- 卡片：安装位置 ----
            RoundedCard card1 = new RoundedCard();
            card1.Text = "安装位置";
            card1.Font = UiFont(8.5F, FontStyle.Regular);
            card1.Location = new Point(32, 240);
            card1.Size = new Size(536, 72);
            Controls.Add(card1);

            txtDir = new TextBox();
            txtDir.Text = InstallerLogic.DefaultDir();
            txtDir.Location = new Point(18, 36);
            txtDir.Size = new Size(396, 26);
            txtDir.BorderStyle = BorderStyle.FixedSingle;
            card1.Controls.Add(txtDir);

            btnBrowse = new RoundedButton();
            btnBrowse.Text = "浏览";
            btnBrowse.Size = new Size(88, 28);
            btnBrowse.Location = new Point(428, 35);
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
            card2.Location = new Point(32, 332);
            card2.Size = new Size(536, 102);
            Controls.Add(card2);

            lblNodeStatus = new Label();
            lblNodeStatus.Location = new Point(52, 36);
            lblNodeStatus.AutoSize = true;
            lblNodeStatus.Font = UiFont(10F, FontStyle.Bold);
            lblNodeStatus.Text = "检测中...";
            lblNodeStatus.ForeColor = TextGray;
            card2.Controls.Add(lblNodeStatus);

            PictureBox nodeIcon = new PictureBox();
            nodeIcon.Image = IconAssets.Node;
            nodeIcon.SizeMode = PictureBoxSizeMode.Zoom;
            nodeIcon.Size = new Size(22, 22);
            nodeIcon.Location = new Point(20, 38);
            card2.Controls.Add(nodeIcon);

            chkNode = new IconCheckBox();
            chkNode.Text = "安装 Node.js（未检测到，将自动下载约 35MB）";
            chkNode.Location = new Point(16, 66);
            chkNode.Size = new Size(480, 30);
            chkNode.Font = UiFont(9F, FontStyle.Regular);
            chkNode.Icon = IconAssets.Node;
            chkNode.Checked = true;
            card2.Controls.Add(chkNode);

            // ---- 卡片：安装选项 ----
            RoundedCard card3 = new RoundedCard();
            card3.Text = "安装选项";
            card3.Font = UiFont(8.5F, FontStyle.Regular);
            card3.Location = new Point(32, 454);
            card3.Size = new Size(536, 96);
            Controls.Add(card3);

            chkShortcut = new IconCheckBox();
            chkShortcut.Text = "添加桌面快捷方式";
            chkShortcut.Location = new Point(16, 34);
            chkShortcut.Size = new Size(300, 30);
            chkShortcut.Font = UiFont(9F, FontStyle.Regular);
            chkShortcut.Icon = IconAssets.Desktop;
            chkShortcut.Checked = true;
            card3.Controls.Add(chkShortcut);

            chkLaunch = new IconCheckBox();
            chkLaunch.Text = "安装完成后直接打开";
            chkLaunch.Location = new Point(16, 64);
            chkLaunch.Size = new Size(300, 30);
            chkLaunch.Font = UiFont(9F, FontStyle.Regular);
            chkLaunch.Icon = IconAssets.Rocket;
            chkLaunch.Checked = true;
            card3.Controls.Add(chkLaunch);

            // ---- 步骤徽章 ----
            string[] steps = { "解压文件", "运行环境", "安装依赖", "完成" };
            badges = new StepBadge[4];
            for (int i = 0; i < 4; i++) {
                StepBadge sb = new StepBadge();
                sb.StepText = steps[i];
                sb.BadgeNumber = i + 1;
                sb.Size = new Size(128, 30);
                sb.Location = new Point(32 + i * 134, 566);
                sb.Font = UiFont(9F, FontStyle.Regular);
                badges[i] = sb;
                Controls.Add(sb);
            }

            // ---- 进度条 ----
            prog = new RoundedProgressBar();
            prog.Location = new Point(36, 606);
            prog.Size = new Size(528, 18);
            prog.Maximum = 100;
            prog.Font = UiFont(8F, FontStyle.Regular);
            Controls.Add(prog);

            // ---- 状态 ----
            lblStatus = new Label();
            lblStatus.Location = new Point(36, 630);
            lblStatus.Size = new Size(528, 22);
            lblStatus.ForeColor = TextGray;
            lblStatus.Font = UiFont(8.5F, FontStyle.Regular);
            lblStatus.TextAlign = ContentAlignment.MiddleLeft;
            Controls.Add(lblStatus);

            // ---- 按钮 ----
            btnInstall = new RoundedButton();
            btnInstall.Text = "开 始 安 装";
            btnInstall.Size = new Size(176, 46);
            btnInstall.Location = new Point(178, 658);
            btnInstall.BackColor = MainBlue;
            btnInstall.ForeColor = Color.White;
            btnInstall.HoverColor = MainBlueHover;
            btnInstall.Font = UiFont(11F, FontStyle.Bold);
            btnInstall.Click += StartInstall;
            Controls.Add(btnInstall);

            btnExit = new RoundedButton();
            btnExit.Text = "取 消";
            btnExit.Size = new Size(100, 46);
            btnExit.Location = new Point(368, 658);
            btnExit.BackColor = Color.FromArgb(236, 242, 250);
            btnExit.ForeColor = Color.FromArgb(90, 105, 130);
            btnExit.HoverColor = Color.FromArgb(224, 232, 244);
            btnExit.Font = UiFont(10F, FontStyle.Regular);
            btnExit.Click += delegate { Close(); };
            Controls.Add(btnExit);

            Shown += delegate {
                BeginInvoke((Action)(delegate {
                    // 标题/副标题居中（此时 PreferredWidth 已正确）
                    title.Location = new Point((ClientSize.Width - title.PreferredWidth) / 2, 168);
                    sub.Location = new Point((ClientSize.Width - sub.PreferredWidth) / 2, 202);
                    DetectNode();
                }));
            };
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
