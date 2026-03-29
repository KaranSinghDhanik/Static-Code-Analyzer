# Static Code Analyzer

A static code analyzer built using fundamental **compiler design techniques**: lexical analysis, syntax analysis, and semantic checking. It detects common programming issues and outputs an **ATS (Acceptability Test Score)** to measure code quality and efficiency.

## Project Goals

- Apply compiler techniques beyond code translation
- Demonstrate program correctness and quality analysis
- Show how lexical, syntactic, and semantic phases work in practice
- Provide a **quantitative efficiency score (ATS)** for analyzed code

## Features

### Issues Detected

| Issue | Type | Description |
|-------|------|-------------|
| **Undeclared variables** | Error | Variable used without declaration |
| **Redeclaration** | Error | Variable declared more than once |
| **Use before initialization** | Error | Variable read before first assignment |
| **Type mismatch** | Error | Incompatible type in assignment (e.g., float to int) |
| **Unused variables** | Warning | Variable declared but never used |

### ATS (Acceptability Test Score)

The **ATS Score** quantifies code quality and efficiency:

- **Base score**: 100
- **Errors**: −15 points each (undeclared, redeclaration, use-before-init, type mismatch)
- **Warnings**: −5 points each (unused variables)

**Ratings:**
- **90–100**: EXCELLENT – Well-structured, efficient code
- **75–89**: GOOD – Minor issues
- **60–74**: FAIR – Several issues need attention
- **40–59**: POOR – Significant issues
- **0–39**: CRITICAL – Major issues; fix before use

## Build & Run

### Prerequisites

- **Flex** (Lex) – Lexical analyzer generator  
  - Windows: Install via [GnuWin32](http://gnuwin32.sourceforge.net/packages/flex.htm) or WSL  
  - Linux: `sudo apt install flex`  
  - macOS: `brew install flex`

- **GCC** – C compiler

### Build

```bash
flex analyser.l
gcc lex.yy.c -o analyzer
```

### Run

**Command line:**
```bash
./analyzer              # uses input.txt
./analyzer input_good.txt
```

**Web frontend (HTML/CSS):**
```bash
pip install flask
python server.py
```
Then open http://localhost:5000 in your browser. Paste code and click **Analyze**.

**Desktop GUI (Tkinter):**
```bash
python frontend.py
```
Opens a simple window where you can paste code and click **Analyze**. Requires Python 3 with tkinter (included with most Python installs).

## Example

**Input (`input.txt`):**
```
int a;
int b;
a = 5;
c = a + b; 
```

**Output:**
- Lexical tokens (KEYWORD, IDENTIFIER, NUMBER, OPERATOR, etc.)
- Error: Undeclared variable `c`
- Semantic report with ATS Score (e.g., 85/100 for one error)

## Project Structure

```
StaticCodeAnalyzer/
├── analyser.l      # Lex specification (lexical + semantic rules)
├── lex.yy.c        # Generated scanner (after running flex)
├── analyzer.exe    # Compiled analyzer
├── index.html      # Web frontend
├── style.css       # Styling
├── app.js          # Frontend logic
├── server.py       # Flask server (run with: python server.py)
├── frontend.py     # Tkinter GUI (optional)
├── requirements.txt
├── input.txt       # Sample input code
└── README.md       # This file
```

## Technical Notes

- The analyzer uses a **symbol table** to track variables, types, and usage
- **Use-before-initialization** is detected by comparing first-use and first-assignment line numbers
- **Type checking** supports `int` and `float`; int literals may be assigned to float
- Syntax is simplified (declarations and assignments); a full parser (e.g., Bison) would enable richer grammar
