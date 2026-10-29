# -*- coding: utf-8 -*-
"""Abis: Sonsuz Gece masaustu baslaticisi. Cift tiklayin veya: python abis.py"""
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL = "http://127.0.0.1:8080"


def say(text):
    print(text, flush=True)


def open_later():
    time.sleep(6)
    webbrowser.open(URL)


def main():
    os.chdir(ROOT)
    if not shutil.which("node") or not shutil.which("npm"):
        say("Node.js kurulu degil. Oyun bunu gerektirir.")
        say("https://nodejs.org adresinden LTS surumunu kurup bu dosyayi yeniden acin.")
        webbrowser.open("https://nodejs.org/tr/download")
        input("Kapatmak icin Enter...")
        return 1
    if not (ROOT / "node_modules").exists():
        say("Ilk acilis. Paketler indiriliyor, bu birkac dakika surebilir...")
        setup = subprocess.run("npm install", cwd=ROOT, shell=True)
        if setup.returncode != 0:
            say("Kurulum basarisiz. Internet baglantinizi kontrol edip yeniden deneyin.")
            input("Kapatmak icin Enter...")
            return setup.returncode
    say("Abis: Sonsuz Gece basliyor. Tarayici birazdan acilacak.")
    say("Kapatmak icin bu pencereyi kapatin.")
    threading.Thread(target=open_later, daemon=True).start()
    return subprocess.call("npm run dev", cwd=ROOT, shell=True)


if __name__ == "__main__":
    sys.exit(main() or 0)
