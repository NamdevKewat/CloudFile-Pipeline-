# CloudFile Pipeline

A focused PDF/image extraction pipeline.

## What it does

Input:
- PDF
- JPG/JPEG
- PNG
- WEBP
- TXT

Processing:
- PDF -> text extraction
- PDF -> rendered page images
- Image -> OCR text
- Image -> image output
- TXT -> text

User chooses an output:
- JSON: structured extraction result
- TXT / Notepad: plain text extraction
- ZIP: packages extracted text + page/image files

The API returns the generated file directly for download. Processing logic is kept in services so it can later be moved to serverless workers.

## Architecture

```text
frontend (React/Vite)
        |
        v
Express API
        |
        +--> validation/upload
        |
        +--> extraction service
        |      +--> PDF text: pdfjs-dist
        |      +--> PDF pages: @napi-rs/canvas + pdfjs-dist
        |      +--> image OCR: tesseract.js
        |      +--> image metadata: sharp
        |
        +--> output service
               +--> JSON
               +--> TXT
               +--> ZIP
```

## Requirements

- Node.js 18+
- npm

## Setup

```bash
npm run install-all
```

Copy:

```text
backend/.env.example -> backend/.env
```

Then run:

```bash
npm run dev
```

For a complete startup from the project root, use `npm start` or `start.bat`.
Set `MONGO_URI` and `JWT_SECRET` in `backend/.env` to enable authentication. The extraction API can run without MongoDB.

Frontend: http://localhost:5173  
Backend: http://localhost:5000

## API

### POST /api/pipeline/process

Multipart form:
- `file`: input PDF/image/TXT
- `output`: `json`, `txt`, or `zip`

Example response for JSON:

```json
{
  "success": true,
  "data": {
    "source": "document.pdf",
    "type": "application/pdf",
    "text": "..."
  }
}
```

For `txt` and `zip`, the API sends a downloadable file.

### GET /api/health

Health check.

## Notes

PDF image extraction is implemented as **page-image extraction**: each PDF page is rendered to PNG. This is more reliable cross-platform than attempting to pull every embedded image object from arbitrary PDFs.

For images, OCR text is extracted with Tesseract.js.

No database or authentication is included because this pipeline is intentionally focused on extraction + selected output.
