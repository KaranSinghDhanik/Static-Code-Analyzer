const codeInput = document.getElementById("code-input");
const output = document.getElementById("output");
const analyzeBtn = document.getElementById("analyze");
const loadSampleBtn = document.getElementById("load-sample");

const SAMPLE_CODE = `int a;
int b;
a = 5;
c = a + b;
`;

/* 🔥 Format output nicely */
function formatOutput(text) {
  const lines = text.split("\n");
  let formatted = "";

  lines.forEach(line => {
    if (line.includes("Error")) {
      formatted += `<div class="error">${line}</div>`;
    } 
    else if (line.includes("Warning")) {
      formatted += `<div class="warning">${line}</div>`;
    } 
    else if (line.includes("ATS Score")) {
      formatted += `<div class="score">${line}</div>`;
    } 
    else if (line.includes("Rating")) {
      formatted += `<div class="success">${line}</div>`;
    } 
    else if (line.includes("====")) {
      formatted += `<div class="section">${line}</div>`;
    } 
    else {
      formatted += `<div>${line}</div>`;
    }
  });

  return formatted;
}


loadSampleBtn.addEventListener("click", () => {
  codeInput.value = SAMPLE_CODE;
});


analyzeBtn.addEventListener("click", async () => {
  const code = codeInput.value.trim();

  if (!code) {
    output.innerHTML = `<div class="error">Please enter some code to analyze.</div>`;
    return;
  }

  output.innerHTML = "";
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
      output.innerHTML = `<div class="error">${text || "Analysis failed."}</div>`;
      return;
    }


    output.innerHTML = formatOutput(text);

  } catch (err) {
    output.innerHTML = `<div class="error">Error: Could not reach server. Make sure the server is running (python server.py).</div>`;
  } finally {
    output.classList.remove("loading");
    analyzeBtn.disabled = false;
  }
});