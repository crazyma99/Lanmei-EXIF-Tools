import subprocess
import time
import webbrowser
import os
import sys
import signal

def start_dev():
    print("正在启动服务...")
    
    # 1. 启动 Flask 后端
    print("启动后端 (port 5000)...")
    backend = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=os.getcwd(),
        env=os.environ.copy()
    )

    # 2. 启动 Frontend
    print("启动前端 (port 3000)...")
    frontend_cwd = os.path.join(os.getcwd(), "frontend")
    # Windows 下 npm 需要用 shell=True 或通过 cmd /c 执行
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    frontend = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=frontend_cwd,
        env=os.environ.copy()
    )

    # 3. 等待服务启动
    print("等待服务启动...")
    time.sleep(5)  # 给一些启动时间

    # 4. 打开浏览器
    url = "http://localhost:3000"
    print(f"正在打开浏览器: {url}")
    webbrowser.open(url)

    try:
        # 保持主进程运行，直到被中断
        while True:
            time.sleep(1)
            # 检查子进程是否还存活
            if backend.poll() is not None:
                print("后端服务意外退出")
                break
            if frontend.poll() is not None:
                print("前端服务意外退出")
                break
    except KeyboardInterrupt:
        print("\n正在停止服务...")
    finally:
        # 清理子进程
        backend.terminate()
        frontend.terminate()
        # 给一点时间让进程退出
        time.sleep(1)
        if backend.poll() is None:
            backend.kill()
        if frontend.poll() is None:
            frontend.kill()
        print("服务已停止")

if __name__ == "__main__":
    start_dev()
