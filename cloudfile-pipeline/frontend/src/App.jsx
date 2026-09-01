import React, { useRef, useState } from "react";
import { FileJson, FileText, FileArchive, UploadCloud, X, Loader2, CheckCircle2 } from "lucide-react";

const API = "http://localhost:5000/api";
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.txt";

export default function App() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [output, setOutput] = useState("json");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const choose = (f) => {
    if (!f) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];
    if (!allowed.includes(f.type)) {
      setError("Please choose PDF, JPG, PNG, WEBP, or TXT.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("Maximum file size is 25 MB.");
      return;
    }
    setError("");
    setResult(null);
    setFile(f);
  };

  const process = async () => {
    if (!file) return setError("Choose a file first.");
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("output", output);

      const response = await fetch(`${API}/pipeline/process`, {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        let message = "Processing failed.";
        try { message = (await response.json()).message || message; } catch {}
        throw new Error(message);
      }

      if (output === "json") {
        const json = await response.json();
        setResult(json.data);
      } else {
        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") || "";
        const match = disposition.match(/filename="([^"]+)"/);
        const filename = match?.[1] || `${file.name}-extracted.${output === "zip" ? "zip" : "txt"}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setResult({ download: filename });
      }
    } catch (e) {
      setError(e.message || "Unable to process the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <header>
        <div className="brand"><span>CF</span> CloudFile Pipeline</div>
        <div className="badge">EXTRACT → RETURN</div>
      </header>

      <main>
        <section className="hero">
          <p className="kicker">PDF & IMAGE EXTRACTION PIPELINE</p>
          <h1>Extract content.<br/><em>Choose your output.</em></h1>
          <p className="sub">
            Upload a PDF, image, or text file. The pipeline extracts text and page images,
            then returns JSON, a Notepad TXT file, or a ZIP package.
          </p>
        </section>

        <section className="card">
          <div
            className={`drop ${drag ? "active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); }}
          >
            <div className="upload-circle"><UploadCloud size={27}/></div>
            <h2>{file ? file.name : "Drop your file here"}</h2>
            <p>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF · JPG · PNG · WEBP · TXT · max 25 MB"}</p>
            <button onClick={() => inputRef.current?.click()}>Choose file</button>
            <input ref={inputRef} hidden type="file" accept={ACCEPT} onChange={(e) => choose(e.target.files[0])}/>
          </div>

          {file && (
            <div className="selected">
              <div>
                <strong>Selected input</strong>
                <span>{file.type || "file"} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button className="icon" onClick={() => { setFile(null); setResult(null); }}><X size={17}/></button>
            </div>
          )}

          <div className="output-title">
            <div><span className="kicker">OUTPUT FORMAT</span><h2>How should we return it?</h2></div>
          </div>

          <div className="choices">
            {[
              ["json", FileJson, "JSON", "Structured text + metadata"],
              ["txt", FileText, "Notepad / TXT", "Plain extracted text"],
              ["zip", FileArchive, "ZIP", "Text + extracted page images"]
            ].map(([value, Icon, title, desc]) => (
              <button key={value} className={`choice ${output === value ? "chosen" : ""}`} onClick={() => setOutput(value)}>
                <Icon size={23}/>
                <span><strong>{title}</strong><small>{desc}</small></span>
                {output === value && <CheckCircle2 className="check" size={17}/>}
              </button>
            ))}
          </div>

          <button className="process" onClick={process} disabled={busy || !file}>
            {busy ? <><Loader2 className="spin" size={19}/> Processing…</> : <>Extract & Return →</>}
          </button>

          {error && <div className="error">{error}</div>}

          {result && output === "json" && (
            <div className="result">
              <div className="result-head"><strong>JSON result</strong><span>{result.pageCount ? `${result.pageCount} pages` : "Extracted"}</span></div>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}

          {result?.download && (
            <div className="success"><CheckCircle2 size={18}/> Downloaded: <strong>{result.download}</strong></div>
          )}
        </section>

        <div className="flow">
          <span>UPLOAD</span><b>→</b><span>EXTRACT</span><b>→</b><span>CHOOSE OUTPUT</span><b>→</b><span>RETURN</span>
        </div>
      </main>

      <footer>CloudFile Pipeline · focused extraction workflow</footer>
    </div>
  );
}
