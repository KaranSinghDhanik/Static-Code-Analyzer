"""
Simple frontend for the Static Code Analyzer.
Requires Python 3 with tkinter (usually built-in).
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import subprocess
import os
import sys


def get_base_path():
    """Get the directory containing this script (and analyzer.exe)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def analyze():
    """Run the analyzer on the code in the input box."""
    code = input_text.get("1.0", tk.END)
    if not code.strip():
        messagebox.showinfo("Info", "Please enter some code to analyze.")
        return

    base = get_base_path()
    input_file = os.path.join(base, "input.txt")
    analyzer_exe = os.path.join(base, "analyzer.exe")

    if not os.path.exists(analyzer_exe):
        messagebox.showerror("Error", f"analyzer.exe not found in:\n{base}\n\nRun 'win_flex analyser.l' then 'gcc lex.yy.c -o analyzer.exe' first.")
        return

    try:
        with open(input_file, "w") as f:
            f.write(code)

        result = subprocess.run(
            [analyzer_exe],
            cwd=base,
            capture_output=True,
            text=True,
            timeout=10
        )

        output = result.stdout
        if result.stderr:
            output += "\n" + result.stderr

        output_text.delete("1.0", tk.END)
        output_text.insert(tk.END, output if output.strip() else "(No output)")

    except subprocess.TimeoutExpired:
        messagebox.showerror("Error", "Analyzer timed out.")
    except Exception as e:
        messagebox.showerror("Error", str(e))


def load_sample():
    """Load sample code into the input area."""
    sample = """int a;
int b;
a = 5;
c = a + b;
"""
    input_text.delete("1.0", tk.END)
    input_text.insert(tk.END, sample)


def main():
    global input_text, output_text

    root = tk.Tk()
    root.title("Static Code Analyzer")
    root.geometry("800x650")
    root.minsize(600, 500)

    # Style
    style = ttk.Style()
    style.configure("TButton", padding=6)
    style.configure("TLabel", font=("Segoe UI", 10))

    main_frame = ttk.Frame(root, padding=10)
    main_frame.pack(fill=tk.BOTH, expand=True)

    # Input section
    ttk.Label(main_frame, text="Code to analyze:", font=("Segoe UI", 11, "bold")).pack(anchor=tk.W)
    input_frame = ttk.Frame(main_frame)
    input_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))

    input_text = scrolledtext.ScrolledText(
        input_frame,
        wrap=tk.WORD,
        font=("Consolas", 11),
        height=12,
        bg="#1e1e1e",
        fg="#d4d4d4",
        insertbackground="white"
    )
    input_text.pack(fill=tk.BOTH, expand=True)

    # Buttons
    btn_frame = ttk.Frame(main_frame)
    btn_frame.pack(fill=tk.X, pady=5)

    ttk.Button(btn_frame, text="Analyze", command=analyze).pack(side=tk.LEFT, padx=(0, 8))
    ttk.Button(btn_frame, text="Load Sample", command=load_sample).pack(side=tk.LEFT)

    # Output section
    ttk.Label(main_frame, text="Analysis output:", font=("Segoe UI", 11, "bold")).pack(anchor=tk.W, pady=(10, 0))
    output_frame = ttk.Frame(main_frame)
    output_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))

    output_text = scrolledtext.ScrolledText(
        output_frame,
        wrap=tk.WORD,
        font=("Consolas", 10),
        height=14,
        bg="#252526",
        fg="#cccccc",
        insertbackground="white",
        state=tk.NORMAL
    )
    output_text.pack(fill=tk.BOTH, expand=True)

    # Load sample by default
    load_sample()

    root.mainloop()


if __name__ == "__main__":
    main()
