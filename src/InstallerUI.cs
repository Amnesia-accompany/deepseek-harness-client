// ============================================================
//  DeepSeek Harness 客户端 - 安装界面（Node.js 风格）
//  InstallerUI.cs
//  经典安装向导布局：顶部绿色标题条 + 左侧深绿品牌栏
//  + 右侧白色内容区 + 底部按钮栏（仿 Node.js 官方安装器）
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

    // ---------- 圆角按钮 ----------
    class RoundedButton : Button {
        public int Radius = 6;
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
            if (!Enabled) back = Color.FromArgb(185, 195, 205);
            else if (hovering && HoverColor != Color.Empty) back = HoverColor;
            using (GraphicsPath p = Rounded.Path(rect, Radius)) {
                using (SolidBrush b = new SolidBrush(back)) e.Graphics.FillPath(b, p);
                if (Enabled) using (Pen bp = new Pen(Color.FromArgb(40, 0, 0, 0), 1)) e.Graphics.DrawPath(bp, p);
            }
            TextRenderer.DrawText(e.Graphics, Text, Font, rect,
                Enabled ? ForeColor : Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
    }

    // ---------- 圆角卡片 ----------
    class RoundedCard : Panel {
        public int Radius = 6;
        public Color BorderColor = Color.FromArgb(215, 220, 226);

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
            if (!string.IsNullOrEmpty(Text)) {
                using (SolidBrush tb = new SolidBrush(Color.FromArgb(90, 100, 112))) {
                    e.Graphics.DrawString(Text, Font, tb, 12, 8);
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
                using (SolidBrush b = new SolidBrush(Color.FromArgb(224, 228, 234))) e.Graphics.FillPath(b, p);
            }
            if (marquee) {
                int mw = Math.Max(80, Width / 3);
                int x = marqueeOffset - mw;
                if (x > Width) x = marqueeOffset - mw - 260;
                using (GraphicsPath p = Rounded.Path(new Rectangle(x, 2, mw, Height - 5), rad)) {
                    using (LinearGradientBrush b = new LinearGradientBrush(new Rectangle(x, 2, mw, Height - 5),
                        Color.FromArgb(102, 187, 106), Color.FromArgb(46, 125, 50), 0f)) {
                        e.Graphics.FillPath(b, p);
                    }
                }
                return;
            }
            int fillW = (int)((float)value / maximum * Width);
            if (fillW > 6) {
                using (GraphicsPath p = Rounded.Path(new Rectangle(0, 2, fillW, Height - 5), rad)) {
                    using (LinearGradientBrush b = new LinearGradientBrush(new Rectangle(0, 2, fillW, Height - 5),
                        Color.FromArgb(102, 187, 106), Color.FromArgb(46, 125, 50), 0f)) {
                        e.Graphics.FillPath(b, p);
                    }
                }
            }
            if (!marquee && value > 0 && value < 100) {
                string pct = value + "%";
                SizeF sz = e.Graphics.MeasureString(pct, Font);
                using (SolidBrush tb = new SolidBrush(Color.FromArgb(70, 90, 75))) {
                    e.Graphics.DrawString(pct, Font, tb, Width - sz.Width - 4, 2);
                }
            }
        }
    }

    // ---------- 图标复选框（自绘） ----------
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
            if (hovering) {
                using (GraphicsPath hp = Rounded.Path(new Rectangle(0, 1, Width - 1, Height - 3), 6)) {
                    using (SolidBrush hb = new SolidBrush(Color.FromArgb(24, 67, 160, 71))) e.Graphics.FillPath(hb, hp);
                }
            }
            if (icon != null) e.Graphics.DrawImage(icon, new Rectangle(6, 5, 20, 20));
            Rectangle box = new Rectangle(32, 5, 18, 18);
            using (GraphicsPath bp = Rounded.Path(box, 4)) {
                if (checkedState) {
                    using (SolidBrush bb = new SolidBrush(Color.FromArgb(67, 160, 71))) e.Graphics.FillPath(bb, bp);
                    using (Pen wp = new Pen(Color.White, 2.2f)) {
                        e.Graphics.DrawLine(wp, box.X + 4, box.Y + 9, box.X + 8, box.Y + 13);
                        e.Graphics.DrawLine(wp, box.X + 8, box.Y + 13, box.X + 14, box.Y + 5);
                    }
                }
                else {
                    using (SolidBrush bb = new SolidBrush(Color.White)) e.Graphics.FillPath(bb, bp);
                    using (Pen gp = new Pen(Color.FromArgb(170, 182, 190), 1.4f)) e.Graphics.DrawPath(gp, bp);
                }
            }
            TextRenderer.DrawText(e.Graphics, Text, Font,
                new Rectangle(58, 0, Width - 60, Height),
                Color.FromArgb(70, 80, 90),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
    }

    // ---------- 步骤徽章（连线） ----------
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
            if (BadgeNumber < 4) {
                int lineY = 13;
                Color lc = State == 2 ? Color.FromArgb(67, 160, 71) : Color.FromArgb(214, 220, 226);
                using (Pen lp = new Pen(lc, 2.2f)) e.Graphics.DrawLine(lp, 28, lineY, Width - 6, lineY);
            }
            Rectangle badge = new Rectangle(0, 1, 26, 26);
            Color bc = Color.FromArgb(210, 216, 222);
            if (State == 1) bc = Color.FromArgb(46, 125, 50);
            else if (State == 2) bc = Color.FromArgb(67, 160, 71);
            using (GraphicsPath p = Rounded.Path(badge, 13)) {
                using (SolidBrush b = new SolidBrush(bc)) e.Graphics.FillPath(b, p);
            }
            string mark = State == 2 ? "✓" : BadgeNumber.ToString();
            using (SolidBrush tb = new SolidBrush(Color.White)) {
                e.Graphics.DrawString(mark, new Font(Font.FontFamily, 9F, FontStyle.Bold), tb, badge.X + 6, badge.Y + 3);
            }
            Color tc = State == 0 ? Color.FromArgb(140, 150, 160) : Color.FromArgb(50, 60, 70);
            using (SolidBrush tb = new SolidBrush(tc)) {
                e.Graphics.DrawString(StepText, new Font(Font.FontFamily, 9F), tb, 34, 5);
            }
        }
    }

    // ==================== 安装界面（Node.js 风格） ====================
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
        bool hasNode;

        static readonly Color TopGreen = Color.FromArgb(46, 125, 50);
        static readonly Color TopGreenDark = Color.FromArgb(27, 94, 32);
        static readonly Color SideGreen = Color.FromArgb(24, 74, 28);
        static readonly Color BtnGreen = Color.FromArgb(67, 160, 71);
        static readonly Color BtnGreenHover = Color.FromArgb(76, 175, 80);
        static readonly Color TitleDark = Color.FromArgb(51, 51, 51);
        static readonly Color TextGray = Color.FromArgb(110, 118, 126);

        const int WIN_W = 660;
        const int WIN_H = 560;
        const int SIDE_W = 165;
        const int TOP_H = 44;
        const int BOT_H = 60;
        const int CONTENT_X = 190;

        static Font UiFont(float size, FontStyle style) {
            try { return new Font("Microsoft YaHei UI", size, style); }
            catch { return new Font(FontFamily.GenericSansSerif, size, style); }
        }

        // 渐变 Panel
        class GradientPanel : Panel {
            public Color C1 = Color.White;
            public Color C2 = Color.White;
            public float Angle = 90f;
            public GradientPanel() {
                SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            }
            protected override void OnPaint(PaintEventArgs e) {
                using (LinearGradientBrush b = new LinearGradientBrush(ClientRectangle, C1, C2, Angle)) {
                    e.Graphics.FillRectangle(b, ClientRectangle);
                }
            }
        }

        public InstallForm() {
            Text = "DeepSeek Harness 安装";
            Font = UiFont(9F, FontStyle.Regular);
            ClientSize = new Size(WIN_W, WIN_H);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            DoubleBuffered = true;

            MouseDown += OnDragMouseDown;

            // ---- 顶部绿色条（纯色，与文字同色避免白底） ----
            Panel topBar = new Panel();
            topBar.BackColor = TopGreen;
            topBar.Location = new Point(0, 0);
            topBar.Size = new Size(WIN_W, TOP_H);
            Controls.Add(topBar);

            Label topTitle = new Label();
            topTitle.Text = "   DeepSeek Harness v0.1.1 安装程序";
            topTitle.BackColor = TopGreen;
            topTitle.ForeColor = Color.White;
            topTitle.Font = UiFont(10F, FontStyle.Regular);
            topTitle.AutoSize = true;
            topTitle.Location = new Point(16, 12);
            topBar.Controls.Add(topTitle);

            btnClose = new RoundedButton();
            btnClose.Text = "✕";
            btnClose.Size = new Size(30, 24);
            btnClose.Location = new Point(WIN_W - 40, 9);
            btnClose.BackColor = TopGreen;
            btnClose.ForeColor = Color.White;
            btnClose.HoverColor = Color.FromArgb(180, 60, 50);
            btnClose.Font = UiFont(9F, FontStyle.Regular);
            btnClose.Click += delegate { Close(); };
            topBar.Controls.Add(btnClose);

            // ---- 左侧深绿品牌栏（纯色） ----
            Panel sideBar = new Panel();
            sideBar.BackColor = SideGreen;
            sideBar.Location = new Point(0, TOP_H);
            sideBar.Size = new Size(SIDE_W, WIN_H - TOP_H - BOT_H);
            Controls.Add(sideBar);

            PictureBox logo = new PictureBox();
            logo.BackColor = SideGreen;
            logo.SizeMode = PictureBoxSizeMode.Zoom;
            logo.Size = new Size(112, 112);
            logo.Location = new Point((SIDE_W - 112) / 2, 66);
            Image logoImg = IconAssets.Logo;
            if (logoImg != null) logo.Image = logoImg;
            sideBar.Controls.Add(logo);

            Label brand = new Label();
            brand.Text = "DeepSeek Harness";
            brand.BackColor = SideGreen;
            brand.ForeColor = Color.White;
            brand.Font = UiFont(12.5F, FontStyle.Bold);
            brand.AutoSize = true;
            brand.Location = new Point((SIDE_W - brand.PreferredWidth) / 2, 196);
            brand.TextAlign = ContentAlignment.MiddleCenter;
            sideBar.Controls.Add(brand);

            Label subBrand = new Label();
            subBrand.Text = "一键部署客户端";
            subBrand.BackColor = SideGreen;
            subBrand.ForeColor = Color.FromArgb(170, 200, 172);
            subBrand.Font = UiFont(9F, FontStyle.Regular);
            subBrand.AutoSize = true;
            subBrand.Location = new Point((SIDE_W - subBrand.PreferredWidth) / 2, 224);
            sideBar.Controls.Add(subBrand);

            Label ver = new Label();
            ver.Text = "v0.1.1";
            ver.BackColor = SideGreen;
            ver.ForeColor = Color.FromArgb(120, 150, 122);
            ver.Font = UiFont(8.5F, FontStyle.Regular);
            ver.AutoSize = true;
            ver.Location = new Point((SIDE_W - ver.PreferredWidth) / 2, 420);
            sideBar.Controls.Add(ver);

            // ---- 右侧内容区 ----
            Label title = new Label();
            title.Text = "欢迎使用 DeepSeek Harness 安装向导";
            title.Font = UiFont(14F, FontStyle.Bold);
            title.ForeColor = TitleDark;
            title.AutoSize = true;
            title.Location = new Point(CONTENT_X, 60);
            Controls.Add(title);

            Label sub = new Label();
            sub.Text = "安装向导将在您的电脑上安装 DeepSeek Harness 客户端。\n请检查以下设置，然后点击「安装」继续。";
            sub.Font = UiFont(9F, FontStyle.Regular);
            sub.ForeColor = TextGray;
            sub.AutoSize = true;
            sub.Location = new Point(CONTENT_X, 92);
            Controls.Add(sub);

            // 卡片1：安装位置
            RoundedCard card1 = new RoundedCard();
            card1.Text = "安装位置";
            card1.Font = UiFont(8F, FontStyle.Regular);
            card1.Location = new Point(CONTENT_X - 5, 138);
            card1.Size = new Size(455, 60);
            Controls.Add(card1);

            txtDir = new TextBox();
            txtDir.Text = InstallerLogic.DefaultDir();
            txtDir.Location = new Point(14, 30);
            txtDir.Size = new Size(336, 24);
            txtDir.BorderStyle = BorderStyle.FixedSingle;
            card1.Controls.Add(txtDir);

            btnBrowse = new RoundedButton();
            btnBrowse.Text = "浏览...";
            btnBrowse.Size = new Size(74, 26);
            btnBrowse.Location = new Point(364, 29);
            btnBrowse.BackColor = Color.FromArgb(238, 240, 243);
            btnBrowse.ForeColor = Color.FromArgb(70, 80, 90);
            btnBrowse.HoverColor = Color.FromArgb(226, 230, 234);
            btnBrowse.Font = UiFont(8.5F, FontStyle.Regular);
            btnBrowse.Click += delegate {
                using (FolderBrowserDialog d = new FolderBrowserDialog()) {
                    d.Description = "选择安装位置";
                    if (txtDir.Text.Length > 0 && Directory.Exists(txtDir.Text)) d.SelectedPath = txtDir.Text;
                    if (d.ShowDialog(this) == DialogResult.OK) txtDir.Text = d.SelectedPath;
                }
            };
            card1.Controls.Add(btnBrowse);

            // 卡片2：运行环境
            RoundedCard card2 = new RoundedCard();
            card2.Text = "运行环境检测";
            card2.Font = UiFont(8F, FontStyle.Regular);
            card2.Location = new Point(CONTENT_X - 5, 210);
            card2.Size = new Size(455, 90);
            Controls.Add(card2);

            lblNodeStatus = new Label();
            lblNodeStatus.Location = new Point(14, 32);
            lblNodeStatus.AutoSize = true;
            lblNodeStatus.Font = UiFont(10F, FontStyle.Bold);
            lblNodeStatus.Text = "检测中...";
            lblNodeStatus.ForeColor = TextGray;
            card2.Controls.Add(lblNodeStatus);

            chkNode = new IconCheckBox();
            chkNode.Text = "安装 Node.js（未检测到，将自动下载约 35MB）";
            chkNode.Location = new Point(12, 60);
            chkNode.Size = new Size(430, 26);
            chkNode.Font = UiFont(8.5F, FontStyle.Regular);
            chkNode.Icon = IconAssets.Node;
            chkNode.Checked = true;
            card2.Controls.Add(chkNode);

            // 卡片3：安装选项
            RoundedCard card3 = new RoundedCard();
            card3.Text = "安装选项";
            card3.Font = UiFont(8F, FontStyle.Regular);
            card3.Location = new Point(CONTENT_X - 5, 312);
            card3.Size = new Size(455, 84);
            Controls.Add(card3);

            chkShortcut = new IconCheckBox();
            chkShortcut.Text = "添加桌面快捷方式";
            chkShortcut.Location = new Point(12, 29);
            chkShortcut.Size = new Size(300, 26);
            chkShortcut.Font = UiFont(8.5F, FontStyle.Regular);
            chkShortcut.Icon = IconAssets.Desktop;
            chkShortcut.Checked = true;
            card3.Controls.Add(chkShortcut);

            chkLaunch = new IconCheckBox();
            chkLaunch.Text = "安装完成后直接打开";
            chkLaunch.Location = new Point(12, 56);
            chkLaunch.Size = new Size(300, 26);
            chkLaunch.Font = UiFont(8.5F, FontStyle.Regular);
            chkLaunch.Icon = IconAssets.Rocket;
            chkLaunch.Checked = true;
            card3.Controls.Add(chkLaunch);

            // 步骤徽章
            string[] steps = { "解压文件", "运行环境", "安装依赖", "完成" };
            badges = new StepBadge[4];
            for (int i = 0; i < 4; i++) {
                StepBadge sb = new StepBadge();
                sb.StepText = steps[i];
                sb.BadgeNumber = i + 1;
                sb.Size = new Size(112, 28);
                sb.Location = new Point(CONTENT_X - 5 + i * 113, 412);
                sb.Font = UiFont(8.5F, FontStyle.Regular);
                badges[i] = sb;
                Controls.Add(sb);
            }

            // 进度条
            prog = new RoundedProgressBar();
            prog.Location = new Point(CONTENT_X - 5, 450);
            prog.Size = new Size(455, 16);
            prog.Maximum = 100;
            prog.Font = UiFont(8F, FontStyle.Regular);
            Controls.Add(prog);

            // 状态
            lblStatus = new Label();
            lblStatus.Location = new Point(CONTENT_X - 5, 472);
            lblStatus.Size = new Size(455, 20);
            lblStatus.ForeColor = TextGray;
            lblStatus.Font = UiFont(8F, FontStyle.Regular);
            Controls.Add(lblStatus);

            // ---- 底部按钮栏（纯色浅灰 + 顶部细线） ----
            Panel bottomBar = new Panel();
            bottomBar.BackColor = Color.FromArgb(239, 241, 244);
            bottomBar.Location = new Point(0, WIN_H - BOT_H);
            bottomBar.Size = new Size(WIN_W, BOT_H);
            bottomBar.Paint += delegate(object s, PaintEventArgs e) {
                using (Pen p = new Pen(Color.FromArgb(205, 210, 216))) e.Graphics.DrawLine(p, 0, 0, WIN_W, 0);
            };
            Controls.Add(bottomBar);

            btnInstall = new RoundedButton();
            btnInstall.Text = "安  装";
            btnInstall.Size = new Size(88, 32);
            btnInstall.Location = new Point(WIN_W - 108, 14);
            btnInstall.BackColor = BtnGreen;
            btnInstall.ForeColor = Color.White;
            btnInstall.HoverColor = BtnGreenHover;
            btnInstall.Font = UiFont(10F, FontStyle.Bold);
            btnInstall.Click += StartInstall;
            bottomBar.Controls.Add(btnInstall);

            btnExit = new RoundedButton();
            btnExit.Text = "取  消";
            btnExit.Size = new Size(76, 32);
            btnExit.Location = new Point(WIN_W - 200, 14);
            btnExit.BackColor = Color.FromArgb(240, 242, 245);
            btnExit.ForeColor = Color.FromArgb(80, 88, 96);
            btnExit.HoverColor = Color.FromArgb(228, 232, 236);
            btnExit.Font = UiFont(9F, FontStyle.Regular);
            btnExit.Click += delegate { Close(); };
            bottomBar.Controls.Add(btnExit);

            Shown += delegate {
                BeginInvoke((Action)(delegate {
                    DetectNode();
                }));
            };
        }

        void OnDragMouseDown(object sender, MouseEventArgs e) {
            if (e.Button == MouseButtons.Left && e.Y < TOP_H) {
                ReleaseCapture();
                SendMessage(Handle, WM_NCLBUTTONDOWN, (IntPtr)HTCAPTION, IntPtr.Zero);
            }
        }

        protected override void OnPaintBackground(PaintEventArgs e) {
            e.Graphics.Clear(Color.White);
        }

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
                        lblNodeStatus.ForeColor = Color.FromArgb(46, 125, 50);
                        chkNode.Visible = false;
                        return;
                    }
                }
            }
            catch { }
            hasNode = false;
            lblNodeStatus.Text = "✘ 未检测到 Node.js";
            lblNodeStatus.ForeColor = Color.FromArgb(198, 60, 50);
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
