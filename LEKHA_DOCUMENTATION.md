# Lekha Documentation

## 1) What this app is
Lekha is a collaborative, AI-assisted document editor built on Next.js App Router.

It combines:
- Real-time collaborative editing (presence, comments, shared room storage)
- Rich-text authoring with TipTap
- AI commands inside the editor (`/lekha`, `/search`, `/chart`/`/mermaid`, `/viz`/`/visualize`)
- CSV-powered dashboard generation and rendering
- AI task-plan generation for task-list items
- Clerk auth with personal + organization-scoped docs
- Convex-backed persistence for documents and uploaded datasets

## 2) Core user flows
1. User signs in with Clerk.
2. User creates a document from blank/template.
3. Document opens in a Liveblocks room for real-time collaboration.
4. User writes in TipTap and can trigger AI commands inline.
5. CSV files can be uploaded per document and used by `/viz`.
6. Task-list items auto-trigger plan generation on Enter.
7. Document can be exported as JSON/HTML/TXT or printed to PDF.

## 3) Tech stack
- Frontend: Next.js 15, React 18, TypeScript, Tailwind, shadcn/ui
- Editor: TipTap (+ custom nodes/extensions)
- Realtime: Liveblocks (`@liveblocks/react`, `@liveblocks/react-tiptap`)
- Backend/Data: Convex
- Auth: Clerk
- AI: OpenAI and Cerebras (runtime-selectable)
- Web search: Tinyfish automation endpoint (DuckDuckGo-driven)
- Data viz: `@json-render/react` + Recharts
- Diagram rendering: Mermaid
- Client state: Zustand + nuqs

## 4) Architecture
### Frontend (App Router)
- Home: templates, document table, search query-param filtering
- Document route: collaborative editor, toolbar, CSV upload bar, task-plan side panel
- API routes: AI/text/search streaming and parsing endpoints

### Backend
- Convex tables:
  - `documents`
  - `csvData`
  - `pdfDocuments`
- Convex queries/mutations enforce auth/ownership/org checks for writes.

### Realtime and auth
- Clerk session controls app access.
- `/api/liveblocks-auth` validates room access against Convex `documents`.
- Liveblocks room storage holds:
  - `leftMargin`, `rightMargin`
  - `todoPlans` (`LiveMap`)

## 5) Data model (Convex)
### `documents`
Fields:
- `title: string`
- `initialContent?: string`
- `ownerId: string`
- `roomId?: string`
- `organizationId?: string`

Indexes:
- `by_owner_id`
- `by_organization_id`
- search index `search_title` (title + owner/org filter fields)

### `csvData`
Fields:
- `documentId`
- `fileName`
- `headers: string[]`
- `rows: any[][]`
- `rowCount`
- `uploadedBy`, `uploadedAt`, `organizationId?`

Indexes:
- `by_document`
- `by_organization`

### `pdfDocuments`
Fields:
- `documentId`
- `fileName`, `fileSize`
- `storageId` (Convex storage)
- `extractedText`, `pageCount`
- `uploadedBy`, `uploadedAt`, `organizationId?`

Indexes:
- `by_document`
- `by_organization`
- search index `search_content` on extracted text

## 6) Editor capabilities
### Base editing
TipTap with:
- headings, paragraphs, lists, tables, links, underline, colors/highlights
- image + resize
- code blocks (lowlight)
- live collaboration extension from Liveblocks

### Custom command behavior
- `/lekha <prompt>`: general LLM generation
- `/search <query>`: Tinyfish web-search answer insertion
- `/chart <prompt>` or `/mermaid <prompt>`: Mermaid diagram generation
- `/viz <prompt>` or `/visualize <prompt>`: data-viz JSON spec generation

### Task planning
- Typing `[]` transforms into task-list item.
- Pressing Enter in a new task item with text:
  - assigns `todoId`
  - streams AI plan from `/api/llm/todo-plan/stream`
  - stores final plan in Liveblocks `todoPlans`
- Task item node shows view/regenerate actions via sparkles/refresh controls.

## 7) API routes
### LLM inference
- `POST /api/llm` (non-stream)
- `POST /api/llm/stream` (SSE)

Both accept provider (`openai` or `cerebras`) and normalize outputs.

### Mermaid
- `POST /api/llm/mermaid`
- `POST /api/llm/mermaid/stream`

Uses a strict system prompt to produce Mermaid code block output.

### Todo planning
- `POST /api/llm/todo-plan`
- `POST /api/llm/todo-plan/stream`

Generates structured markdown action plans.

### Visualization
- `POST /api/llm/viz/stream`

Builds enhanced prompt from CSV context + inferred column types; expects JSONL patch ops to build a `json-render` spec.

### Search
- `POST /api/search`
- `POST /api/search/stream`

Proxies Tinyfish SSE automation and converts result payload into concise answer + top links text.

### File parsing
- `POST /api/csv/parse`
  - CSV validation and parsing (`Papa.parse`)
  - max 10MB, max 10,000 data rows
- `POST /api/pdf/extract`
  - PDF validation + text extraction (`pdf-parse`)
  - max 10MB

### Other
- `POST /api/liveblocks-auth`: authorizes room access
- `GET /api/csv/list`: helper endpoint (comment notes missing auth context)

## 8) Visualization subsystem
- CSV files are fetched from Convex and exposed on `window.__csvFiles`.
- `/viz` command supports `@file.csv` mention filtering.
- AI emits JSON patch lines that build a `json-render` spec.
- `VizRenderer` renders catalog components:
  - layout components (`Stack`, `Grid`, `Card`)
  - metrics (`StatCard`, `Badge`)
  - charts (`BarChart`, `LineChart`, `AreaChart`, `PieChart`, `ScatterChart`)
  - table and helper UI blocks
- Charts consume data from state path `/csvData/data`.

## 9) Document ownership and access model
- Document creation ties owner to Clerk user id.
- If user is in org, `organizationId` is recorded.
- Listing/searching chooses org scope when present, else personal scope.
- Update/delete allowed for owner or org member (as implemented in Convex mutations).
- Liveblocks room access follows same owner/org-member logic in `/api/liveblocks-auth`.

## 10) Environment variables
Required/used by code:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `LIVEBLOCKS_SECRET_KEY`
- `OPENAI_API_KEY`
- `CEREBRAS_API_KEY` (if using Cerebras)
- `TINYFISH_API_KEY`

Optional:
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `CEREBRAS_MODEL` (default `llama3.1-8b`)
- `TINYFISH_API_URL` (default Tinyfish run-sse URL)

## 11) Run and build
Install:
```bash
npm install
```

Run dev:
```bash
npx convex dev
npm run dev
```

Build/start:
```bash
npm run build
npm run start
```

## 12) Current implementation notes
- `src/app/documents/[documentId]/document.tsx` currently renders `CsvUploadBar`; `PdfContextBar` is present but commented out in UI.
- Root metadata in `src/app/layout.tsx` still has Create Next App defaults.
- Inference provider is user-selectable and persisted in local storage via Zustand.
- Mermaid and LLM command flows use stream-first with non-stream fallback endpoints.
- `GET /api/csv/list` includes an in-code note that auth context is not wired for production use.
