import re
import subprocess
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
URL_FILE = BASE_DIR / "game_url.txt"
SSH_COMMAND = [
    "ssh",
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=/dev/null",
    "-o", "ServerAliveInterval=30",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "BatchMode=yes",
    "-R80:127.0.0.1:8000",
    "nokey@localhost.run",
]


def run_tunnel() -> None:
    while True:
        process = None
        try:
            process = subprocess.Popen(
                SSH_COMMAND,
                cwd=BASE_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
            assert process.stdout is not None
            for line in process.stdout:
                print(line, end="", flush=True)
                match = re.search(r"https://[a-z0-9]+\.lhr\.life", line)
                if match:
                    url = match.group(0)
                    URL_FILE.write_text(url, encoding="utf-8")
                    print(f"Актуальный GAME_URL: {url}", flush=True)
        except OSError as error:
            print(f"Не удалось запустить туннель: {error}", flush=True)
        finally:
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
        print("Туннель отключён, повторное подключение через 3 секунды", flush=True)
        time.sleep(3)


if __name__ == "__main__":
    run_tunnel()
