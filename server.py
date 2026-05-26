"""
Simple HTTP server for the Static Code Analyzer frontend.
Serves the HTML/CSS/JS and runs real-time static analysis as you type.

Usage: python server.py
Then open http://localhost:5000 in your browser.
"""

import json
import os
import re
import subprocess
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder=".")
BASE = Path(__file__).resolve().parent

ERROR_INLINE_RE = re.compile(r"Error \(line (\d+)\): (.+)")
WARNING_INLINE_RE = re.compile(r"Warning \(line (\d+)\): (.+)")
ERROR_BEFORE_INIT_RE = re.compile(
    r"Error: Variable '(\w+)' used at line (\d+) before initialization at line (\d+)"
)
ERROR_NEVER_INIT_RE = re.compile(
    r"Error: Variable '(\w+)' used at line (\d+) but never initialized"
)
UNDECLARED_RE = re.compile(r"Undeclared variable '(\w+)'")
REDECLARATION_RE = re.compile(r"Redeclaration of '(\w+)'")
UNUSED_RE = re.compile(r"Unused variable '(\w+)'")
TYPE_MISMATCH_RE = re.compile(
    r"Type mismatch - cannot assign .+ to .+ variable '(\w+)'"
)
ATS_SCORE_RE = re.compile(r"ATS Score:\s+(\d+)\s*/\s*100")
RATING_RE = re.compile(r"Rating:\s+(\w+)")
ERRORS_FOUND_RE = re.compile(r"Errors found:\s+(\d+)")
WARNINGS_FOUND_RE = re.compile(r"Warnings found:\s+(\d+)")


def find_identifier_column(code: str, line_num: int, name: str) -> tuple[int, int]:
    """Return 1-based start/end columns for an identifier on a line."""
    lines = code.split("\n")
    if line_num < 1 or line_num > len(lines):
        return 1, 1

    line = lines[line_num - 1]
    pattern = re.compile(r"\b" + re.escape(name) + r"\b")
    match = pattern.search(line)
    if match:
        return match.start() + 1, match.end() + 1

    return 1, max(len(line), 1) + 1


def parse_analyzer_output(code: str, output: str) -> dict:
    """Convert analyzer stdout into structured diagnostics for the editor."""
    diagnostics = []

    for match in ERROR_INLINE_RE.finditer(output):
        line_num = int(match.group(1))
        message = match.group(2).strip()
        name = None
        for pattern in (UNDECLARED_RE, REDECLARATION_RE, TYPE_MISMATCH_RE):
            name_match = pattern.search(message)
            if name_match:
                name = name_match.group(1)
                break
        if name:
            start_col, end_col = find_identifier_column(code, line_num, name)
        else:
            start_col, end_col = 1, max(len(code.split("\n")[line_num - 1]), 1) + 1
        diagnostics.append(
            {
                "line": line_num,
                "startColumn": start_col,
                "endColumn": end_col,
                "severity": "error",
                "message": message,
            }
        )

    for match in WARNING_INLINE_RE.finditer(output):
        line_num = int(match.group(1))
        message = match.group(2).strip()
        name_match = UNUSED_RE.search(message)
        if name_match:
            start_col, end_col = find_identifier_column(
                code, line_num, name_match.group(1)
            )
        else:
            start_col, end_col = 1, max(len(code.split("\n")[line_num - 1]), 1) + 1
        diagnostics.append(
            {
                "line": line_num,
                "startColumn": start_col,
                "endColumn": end_col,
                "severity": "warning",
                "message": message,
            }
        )

    for match in ERROR_BEFORE_INIT_RE.finditer(output):
        name = match.group(1)
        line_num = int(match.group(2))
        init_line = int(match.group(3))
        start_col, end_col = find_identifier_column(code, line_num, name)
        diagnostics.append(
            {
                "line": line_num,
                "startColumn": start_col,
                "endColumn": end_col,
                "severity": "error",
                "message": (
                    f"Variable '{name}' used before initialization "
                    f"(initialized at line {init_line})"
                ),
            }
        )

    for match in ERROR_NEVER_INIT_RE.finditer(output):
        name = match.group(1)
        line_num = int(match.group(2))
        start_col, end_col = find_identifier_column(code, line_num, name)
        diagnostics.append(
            {
                "line": line_num,
                "startColumn": start_col,
                "endColumn": end_col,
                "severity": "error",
                "message": f"Variable '{name}' used but never initialized",
            }
        )

    ats_score = None
    rating = None
    error_total = None
    warning_total = None

    score_match = ATS_SCORE_RE.search(output)
    if score_match:
        ats_score = int(score_match.group(1))

    rating_match = RATING_RE.search(output)
    if rating_match:
        rating = rating_match.group(1)

    errors_match = ERRORS_FOUND_RE.search(output)
    if errors_match:
        error_total = int(errors_match.group(1))

    warnings_match = WARNINGS_FOUND_RE.search(output)
    if warnings_match:
        warning_total = int(warnings_match.group(1))

    return {
        "diagnostics": diagnostics,
        "ats": {
            "score": ats_score,
            "rating": rating,
            "errors": error_total,
            "warnings": warning_total,
        },
        "raw": output,
    }


def run_analyzer(code: str) -> tuple[str, int]:
    """Write code to input.txt, run analyzer.exe, return stdout and exit code."""
    input_file = BASE / "input.txt"
    analyzer_exe = BASE / "analyzer.exe"

    if not analyzer_exe.exists():
        raise FileNotFoundError(
            "analyzer.exe not found. Build it first:\n"
            "  win_flex analyser.l\n"
            "  gcc lex.yy.c -o analyzer.exe"
        )

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

    return output or "(No output)", result.returncode


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

    try:
        output, _ = run_analyzer(code)
        return output
    except FileNotFoundError as e:
        return str(e), 500
    except subprocess.TimeoutExpired:
        return "Analyzer timed out.", 500
    except Exception as e:
        return str(e), 500


@app.route("/analyze/json", methods=["POST"])
def analyze_json():
    """Real-time analysis endpoint — returns structured diagnostics for inline squiggles."""
    code = request.get_data(as_text=True)
    if not code.strip():
        return jsonify(
            {
                "diagnostics": [],
                "ats": {"score": None, "rating": None, "errors": 0, "warnings": 0},
                "raw": "",
            }
        )

    try:
        output, _ = run_analyzer(code)
        return jsonify(parse_analyzer_output(code, output))
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 500
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Analyzer timed out."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("Static Code Analyzer - Real-time Server")
    print("Open http://localhost:5000 in your browser")
    print("Errors appear as you type (VS Code-style squiggles)")
    print("Press Ctrl+C to stop\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
