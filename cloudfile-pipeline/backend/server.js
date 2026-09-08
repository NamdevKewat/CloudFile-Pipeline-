import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import User from "./models/User.js";
import { processPipeline } from "./services/pipelineService.js";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(backendDir, "../frontend/dist");
dotenv.config({ path: path.join(backendDir, ".env") });

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MAX_MB = Number(process.env.MAX_FILE_MB || 25);
const allowedOrigins = [
  "http://localhost:5173",
  "https://cloudfile-pipeline-engine.onrender.com",
  ...(process.env.CLIENT_URL || "").split(",").map((origin) => origin.trim()).filter(Boolean),
];
await fs.mkdir(path.resolve("uploads"), { recursive: true });
app.use(cors({
  origin: (origin, callback) => {
    const isLocalDevelopment = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "");
    callback(null, !origin || isLocalDevelopment || allowedOrigins.includes(origin));
  },
}));
app.use(express.json());
app.get("/api/health", (_req, res) =>
  res.json({ success: true, message: "CloudFile Pipeline API is running" }),
);
app.use("/api/auth", authRoutes);
const upload = multer({
  dest: path.resolve("uploads"),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_r, f, cb) => {
    const ok = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
    ].includes(f.mimetype);
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});
app.post(
  "/api/pipeline/process",
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      const output = String(req.body.output || "json");
      if (!["json", "txt", "zip"].includes(output))
        return res
          .status(400)
          .json({
            success: false,
            message: "Output must be json, txt, or zip",
          });
      const r = await processPipeline(req.file, output);
      if (r.kind === "json") return res.json({ success: true, data: r.data });
      res.setHeader("Content-Type", r.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${r.filename}"`,
      );
      res.send(r.buffer);
    } catch (e) {
      next(e);
    } finally {
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    }
  },
);
app.use(express.static(frontendDist));
app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
app.use((e, _r, res, _n) => {
  console.error(e);
  res
    .status(e.code === "LIMIT_FILE_SIZE" ? 413 : 400)
    .json({
      success: false,
      message:
        e.code === "LIMIT_FILE_SIZE"
          ? `File is too large. Maximum is ${MAX_MB} MB.`
          : e.message || "Request failed",
    });
});
if (process.env.MONGO_URI) {
  await mongoose.connect(process.env.MONGO_URI);
  await User.collection.dropIndex("username_1").catch((error) => {
    if (error.codeName !== "IndexNotFound") throw error;
  });
  console.log("MongoDB connected");
} else {
  console.warn("MONGO_URI is not configured; authentication endpoints are unavailable");
}
const server = app.listen(PORT, "0.0.0.0", () =>
  console.log(`API running on http://localhost:${PORT}`),
);
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.warn(`API is already running on port ${PORT}`);
    process.exit(0);
  }
  throw error;
});
