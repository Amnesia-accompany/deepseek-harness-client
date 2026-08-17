// ============================================================
//  DeepSeek Harness 懒人客户端 - 卸载器
//  Uninstaller.cs
//  ------------------------------------------------------------
//  功能：
//   - 双击运行：确认后停止服务、删快捷方式、删注册表、删安装目录
//   - 使用"幽灵副本"技术删除自身所在目录（复制到 %TEMP% 执行删除）
//   - 静默模式：/S（测试与自动化用）
//   - 副本模式：-D "安装目录"（由主进程启动，负责延迟删目录）
//  编译：csc /target:winexe /r:System.Management.dll ...
// ============================================================
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Management;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace DSHUninstaller {
    static class Program {
        [STAThread]
        static int Main(string[] args) {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string targetDir = "";
            bool silent = false;
            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "-D" && i + 1 < args.Length) targetDir = args[i + 1].Trim().Trim('"');
                if (args[i] == "/S" || args[i] == "-S") silent = true;
            }
            bool isGhost = targetDir.Length > 0;   // 有 -D = 幽灵副本模式
            if (!isGhost) {
                targetDir = Path.GetDirectoryName(Application.ExecutablePath);
            }

            if (!isGhost && !silent) {
                DialogResult r = MessageBox.Show(
                    "确定要卸载 DeepSeek Harness 客户端吗？\n\n" +
                    "将停止服务并删除以下目录：\n" + targetDir + "\n\n" +
                    "（API Key 和会话记录在 C:\\Users\\你的用户名\\.dsh，不会被删除）",
                    "DeepSeek Harness 卸载", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (r != DialogResult.Yes) return 0;
            }

            try { KillServers(); } catch { }
            try { DeleteShortcut(); } catch { }
            try { DeleteRegistry(); } catch { }

            if (!isGhost) {
                // 主进程：启动幽灵副本负责删目录，然后提示完成
                string ghostDir = Path.Combine(Path.GetTempPath(), "dsh-uninstall-" + Guid.NewGuid().ToString("N"));
                string ghost = Path.Combine(ghostDir, "uninstaller.exe");
                try {
                    Directory.CreateDirectory(ghostDir);
                    File.Copy(Application.ExecutablePath, ghost);
                    Process p = new Process();
                    p.StartInfo.FileName = ghost;
                    p.StartInfo.Arguments = "-D \"" + targetDir + "\"";
                    p.StartInfo.UseShellExecute = false;
                    p.StartInfo.CreateNoWindow = true;
                    p.StartInfo.WindowStyle = ProcessWindowStyle.Hidden;
                    p.Start();
                }
                catch { }
                if (!silent) {
                    MessageBox.Show("卸载完成！", "DeepSeek Harness 卸载",
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                return 0;
            }

            // 幽灵副本：安排延迟删除（安装目录 + 自身临时目录）后退出
            try {
                string cmd = "for /l %i in (1,1,20) do @(rd /s /q \"" + targetDir + "\" 2>nul & " +
                             "rd /s /q \"" + Path.GetDirectoryName(Application.ExecutablePath) + "\" 2>nul & " +
                             "timeout /t 1 /nobreak >nul)";
                Process.Start(new ProcessStartInfo("cmd.exe", "/c " + cmd) {
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = false
                });
            }
            catch { }
            return 0;
        }

        // 停止客户端服务进程（dsh web，不影响 npx 启动的官方实例）
        static void KillServers() {
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
            // 也停掉正在运行的客户端本体
            foreach (Process p in Process.GetProcesses()) {
                try {
                    if (p.ProcessName.IndexOf("大肥鱼", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        p.ProcessName.Equals("electron", StringComparison.OrdinalIgnoreCase)) {
                        p.Kill();
                    }
                }
                catch { }
            }
            Thread.Sleep(800);
        }

        static void DeleteShortcut() {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            foreach (string name in new string[] { "DeepSeek Harness.lnk", "蓝色大肥鱼 DSH.lnk" }) {
                string lnk = Path.Combine(desktop, name);
                if (File.Exists(lnk)) File.Delete(lnk);
            }
        }

        static void DeleteRegistry() {
            foreach (string keyName in new string[] {
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekHarness",
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall\蓝色大肥鱼DSH" }) {
                try {
                    Registry.CurrentUser.DeleteSubKeyTree(keyName, false);
                }
                catch { }
            }
        }
    }
}
