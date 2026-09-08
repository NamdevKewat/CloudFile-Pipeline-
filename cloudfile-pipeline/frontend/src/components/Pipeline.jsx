import { useRef, useState } from "react";
import { CheckCircle2, FileArchive, FileJson, FileText, Loader2, LogOut, ShieldCheck, UploadCloud, X } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];
const OUTPUTS = [
  ["json", FileJson, "JSON", "Structured text + metadata"],
  ["txt", FileText, "Notepad / TXT", "Plain extracted text"],
  ["zip", FileArchive, "ZIP", "Text + extracted page images"],
];

export default function Pipeline({ user, onLogout }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [output, setOutput] = useState("json");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const chooseFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError("Choose PDF, JPG, PNG, WEBP, or TXT.");
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError("Maximum file size is 25 MB.");
      return;
    }
    setFile(selectedFile);
    setError("");
    setResult(null);
  };

  const processFile = async () => {
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("output", output);
      const response = await fetch(`${API}/pipeline/process`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("cf_token")}` },
        body: form,
      });

      if (response.status === 401) {
        onLogout();
        throw new Error("Session expired. Please sign in again.");
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Processing failed");
      }

      if (output === "json") {
        setResult((await response.json()).data);
      } else {
        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") || "";
        const match = disposition.match(/filename="([^"]+)"/);
        const downloadName = match?.[1] || `${file.name}-extracted.${output === "zip" ? "zip" : "txt"}`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadName;
        link.click();
        URL.revokeObjectURL(url);
        setResult({ download: downloadName });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="shell">
      <header>
        <div className="brand"><span>CF</span> CloudFile Pipeline</div>
        <div className="header-right">
          <span className="user">{user.name}</span>
          <button className="logout" onClick={onLogout}><LogOut size={15} /> Logout</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="kicker">PDF &amp; IMAGE EXTRACTION PIPELINE</p>
          <h1>Extract content.<br /><em>Choose your output.</em></h1>
          <p className="sub">Upload a PDF, image, or text file. The pipeline extracts text and page images, then returns JSON, a Notepad TXT file, or a ZIP package.</p>
        </section>

        <section className="card">
          <div
            className={`drop ${drag ? "active" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(event) => { event.preventDefault(); setDrag(false); chooseFile(event.dataTransfer.files[0]); }}
          >
            <div className="upload-circle"><UploadCloud size={27} /></div>
            <h2>{file ? file.name : "Drop your file here"}</h2>
            <p>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF - JPG - PNG - WEBP - TXT - max 25 MB"}</p>
            <button onClick={() => inputRef.current?.click()}>Choose file</button>
            <input ref={inputRef} hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={(event) => chooseFile(event.target.files[0])} />
          </div>

          {file && (
            <div className="selected">
              <div><strong>Selected input</strong><span>{file.type} - {(file.size / 1024 / 1024).toFixed(2)} MB</span></div>
              <button className="icon" onClick={clearFile}><X size={17} /></button>
            </div>
          )}

          <div className="output-title"><p className="kicker">OUTPUT FORMAT</p><h2>How should we return it?</h2></div>
          <div className="choices">
            {OUTPUTS.map(([value, Icon, title, description]) => (
              <button key={value} className={`choice ${output === value ? "chosen" : ""}`} onClick={() => setOutput(value)}>
                <Icon size={23} />
                <span><strong>{title}</strong><small>{description}</small></span>
                {output === value && <CheckCircle2 className="check" size={17} />}
              </button>
            ))}
          </div>

          <button className="process" onClick={processFile} disabled={busy || !file}>
            {busy ? <><Loader2 className="spin" size={18} /> Processing...</> : "Extract & Return ->"}
          </button>
          {error && <div className="error">{error}</div>}
          {result && output === "json" && <div className="result"><div className="result-head"><strong>JSON result</strong><span>{result.pageCount ? `${result.pageCount} pages` : "Extracted"}</span></div><pre>{JSON.stringify(result, null, 2)}</pre></div>}
          {result?.download && <div className="success"><CheckCircle2 size={18} /> Downloaded: <strong>{result.download}</strong></div>}
          <p className="privacy"><ShieldCheck size={13} /> Authenticated processing - temporary files are deleted after processing</p>
        </section>

        <div className="flow"><span>AUTHENTICATE</span><b>-&gt;</b><span>UPLOAD</span><b>-&gt;</b><span>EXTRACT</span><b>-&gt;</b><span>RETURN</span></div>
      </main>
      <footer>CloudFile Pipeline - JWT + MongoDB</footer>
    </div>
  );
}
