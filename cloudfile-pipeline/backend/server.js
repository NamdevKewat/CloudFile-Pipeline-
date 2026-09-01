import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { processPipeline } from "./services/pipelineService.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MAX_MB = Number(process.env.MAX_FILE_MB || 25);

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

const uploadDir = path.resolve("uploads");
await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain"
    ]);
    cb(allowed.has(file.mimetype) ? null : new Error("Unsupported file type"), allowed.has(file.mimetype));
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "CloudFile Pipeline API is running" });
});

app.post("/api/pipeline/process", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const output = String(req.body.output || "json").toLowerCase();
    if (!["json", "txt", "zip"].includes(output)) {
      return res.status(400).json({ success: false, message: "Output must be json, txt, or zip" });
    }

    const result = await processPipeline(req.file, output);

    if (result.kind === "json") {
      return res.json({ success: true, data: result.data });
    }

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const message =
    error.code === "LIMIT_FILE_SIZE"
      ? `File is too large. Maximum is ${MAX_MB} MB.`
      : error.message || "Pipeline processing failed";

  res.status(400).json({ success: false, message });
});

app.listen(PORT, () => {
  console.log(`CloudFile Pipeline API: http://localhost:${PORT}`);
});
