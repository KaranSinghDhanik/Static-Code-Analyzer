const codeInput = document.getElementById("code-input");
const output = document.getElementById("output");
const analyzeBtn = document.getElementById("analyze");
const loadSampleBtn = document.getElementById("load-sample");

const SAMPLE_CODE = `int a;
int b;
a = 5;
c = a + b;
`;

loadSampleBtn.addEventListener("click", () => {
  codeInput.value = SAMPLE_CODE;
});

analyzeBtn.addEventListener("click", async () => {
  const code = codeInput.value.trim();
  if (!code) {
    output.textContent = "Please enter some code to analyze.";
    output.classList.add("error");
    return;
  }

  output.textContent = "";
  output.classList.remove("error");
  output.classList.add("loading");
  analyzeBtn.disabled = true;

  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: code,
    });

    const text = await res.text();

    if (!res.ok) {
      output.textContent = text || "Analysis failed.";
      output.classList.add("error");
      return;
    }

    output.textContent = text;
  } catch (err) {
    output.textContent = "Error: Could not reach server. Make sure the server is running (python server.py).";
    output.classList.add("error");
  } finally {
    output.classList.remove("loading");
    analyzeBtn.disabled = false;
  }
});
