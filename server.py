"""
Simple HTTP server for the Static Code Analyzer frontend.
Serves the HTML/CSS/JS and runs the analyzer when requested.

Usage: python server.py
Then open http://localhost:5000 in your browser.
"""

import os
import subprocess
from pathlib import Path

from flask import Flask, request, send_from_directory

app = Flask(__name__, static_folder=".")
BASE = Path(__file__).resolve().parent


@app.route("/")
def index():
    return send_from_directory(BASE, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(BASE, path)


@app.route("/analyze", methods=["POST"])
def analyze():
    code = request.get_data(as_text=True)
    if not code.strip():
        return "Please enter some code to analyze.", 400

    input_file = BASE / "input.txt"
    analyzer_exe = BASE / "analyzer.exe"

    if not analyzer_exe.exists():
        return (
            "analyzer.exe not found. Build it first:\n"
            "  win_flex analyser.l\n"
            "  gcc lex.yy.c -o analyzer.exe",
            500,
        )

    try:
        input_file.write_text(code, encoding="utf-8")

        result = subprocess.run(
            [str(analyzer_exe)],
            cwd=BASE,
            capture_output=True,
            text=True,
            timeout=10,
        )

        output = result.stdout
        if result.stderr:
            output += "\n" + result.stderr

        return output or "(No output)"

    except subprocess.TimeoutExpired:
        return "Analyzer timed out.", 500
    except Exception as e:
        return str(e), 500


if __name__ == "__main__":
    print("Static Code Analyzer - Server")
    print("Open http://localhost:5000 in your browser")
    print("Press Ctrl+C to stop\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
