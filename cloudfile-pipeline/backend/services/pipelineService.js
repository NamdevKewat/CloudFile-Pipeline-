import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { PassThrough } from "stream";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

function ext(name) {
  return path.extname(name).toLowerCase();
}

async function extractTextFromPdf(filePath) {
  const data = new Uint8Array(await fs.readFile(filePath));
  const pdf = await getDocument({ data }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push({
      page: i,
      text: content.items.map((item) => item.str || "").join(" ").replace(/\s+/g, " ").trim()
    });
  }

  return { pageCount: pdf.numPages, pages };
}

async function renderPdfPages(filePath, workDir) {
  const data = new Uint8Array(await fs.readFile(filePath));
  const pdf = await getDocument({ data }).promise;
  const output = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    const outPath = path.join(workDir, `page-${String(i).padStart(3, "0")}.png`);
    await fs.writeFile(outPath, canvas.toBuffer("image/png"));
    output.push(outPath);
  }
  return output;
}

async function ocrImage(filePath) {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(filePath);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}

async function extractImage(filePath) {
  const meta = await sharp(filePath).metadata();
  const text = await ocrImage(filePath);
  return {
    text,
    images: [{ source: path.basename(filePath), width: meta.width, height: meta.height, format: meta.format }]
  };
}

async function extractTextFile(filePath) {
  return { text: await fs.readFile(filePath, "utf8") };
}

function normalizeText(pdfPages, text = "") {
  if (pdfPages?.length) return pdfPages.map((p) => p.text).filter(Boolean).join("\n\n");
  return text;
}

function toTxt(data) {
  const lines = [`Source: ${data.source}`, `Type: ${data.type}`, ""];
  if (data.pages?.length) {
    for (const page of data.pages) lines.push(`--- Page ${page.page} ---`, page.text || "", "");
  } else {
    lines.push(data.text || "");
  }
  return lines.join("\n");
}

async function bufferFromStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function makeZip(data, pageImages = []) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const pass = new PassThrough();
  archive.pipe(pass);

  archive.append(JSON.stringify(data, null, 2), { name: "extraction.json" });
  archive.append(toTxt(data), { name: "extracted.txt" });

  for (const imagePath of pageImages) {
    archive.file(imagePath, { name: `images/${path.basename(imagePath)}` });
  }

  await archive.finalize();
  return bufferFromStream(pass);
}

export async function processPipeline(file, output) {
  const fileExt = ext(file.originalname);
  const workDir = await fs.mkdtemp(path.join(path.dirname(file.path), "pipeline-"));
  let data;
  let pageImages = [];

  try {
    if (file.mimetype === "application/pdf" || fileExt === ".pdf") {
      const pdf = await extractTextFromPdf(file.path);
      pageImages = await renderPdfPages(file.path, workDir);
      data = {
        source: file.originalname,
        type: "application/pdf",
        pageCount: pdf.pageCount,
        text: normalizeText(pdf.pages),
        pages: pdf.pages,
        images: pageImages.map((p) => ({
          name: path.basename(p),
          type: "image/png"
        }))
      };
    } else if (file.mimetype.startsWith("image/")) {
      const image = await extractImage(file.path);
      const copied = path.join(workDir, `source${fileExt || ".png"}`);
      await fs.copyFile(file.path, copied);
      pageImages = [copied];
      data = {
        source: file.originalname,
        type: file.mimetype,
        text: image.text,
        images: image.images
      };
    } else if (file.mimetype === "text/plain" || fileExt === ".txt") {
      data = {
        source: file.originalname,
        type: "text/plain",
        text: await extractTextFile(file.path).then((x) => x.text)
      };
    } else {
      throw new Error("Unsupported input type");
    }

    if (output === "json") {
      return { kind: "json", data };
    }

    if (output === "txt") {
      return {
        kind: "file",
        filename: `${path.parse(file.originalname).name}-extracted.txt`,
        contentType: "text/plain; charset=utf-8",
        buffer: Buffer.from(toTxt(data), "utf8")
      };
    }

    const zip = await makeZip(data, pageImages);
    return {
      kind: "file",
      filename: `${path.parse(file.originalname).name}-extracted.zip`,
      contentType: "application/zip",
      buffer: zip
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
