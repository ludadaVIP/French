from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import time
import webbrowser


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"


def venv_python() -> Path:
    if os.name == "nt":
        return VENV / "Scripts" / "python.exe"
    return VENV / "bin" / "python"


def venv_pip() -> Path:
    if os.name == "nt":
        return VENV / "Scripts" / "pip.exe"
    return VENV / "bin" / "pip"


def run(command: list[str | Path], cwd: Path) -> None:
    printable = " ".join(str(part) for part in command)
    print(f"\n> {printable}")
    subprocess.check_call([str(part) for part in command], cwd=cwd)


def main() -> int:
    if not venv_python().exists():
        run([sys.executable, "-m", "venv", VENV], ROOT)

    run([venv_pip(), "install", "-r", "requirements.txt"], BACKEND)

    if not (FRONTEND / "node_modules").exists():
        run(["npm.cmd", "install"], FRONTEND)

    run(["npm.cmd", "run", "build"], FRONTEND)

    env = os.environ.copy()
    env.setdefault("PORT", "5055")
    url = f"http://127.0.0.1:{env['PORT']}"
    print(f"\nFrench Sprint: {url}")
    print("Audio cache: backend/data/audio/edge-tts/")

    process = subprocess.Popen([str(venv_python()), "app.py"], cwd=BACKEND, env=env)
    time.sleep(1.2)
    webbrowser.open(url)
    return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
