# Lekha - Collaborative Document Editor

> **Your writing space, tuned for teams**

Lekha is a modern, real-time collaborative document editor built with Next.js 15. It combines the power of Google Docs-style collaboration with AI-powered content generation and web search capabilities.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Project Structure](#project-structure)
5. [Page Summaries](#page-summaries)
6. [Key Features](#key-features)
7. [Data Flow](#data-flow)
8. [API Routes](#api-routes)
9. [Database Schema](#database-schema)
10. [Environment Variables](#environment-variables)

---

## Project Overview

Lekha is a SaaS collaborative document editor that enables teams to:

- Create and edit rich-text documents in real-time
- Collaborate with team members with live cursors and presence
- Add comments and threaded discussions on document sections
- Generate content using AI (`/lekha` command)
- Search the web and insert results (`/search` command)
- Use pre-built templates (resumes, proposals, letters, etc.)
- Export documents in multiple formats (JSON, HTML, PDF, Text)
- Organize documents by personal or organization scope

---

## Technology Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.9 | Full-stack React framework (App Router) |
| React | 18.3.1 | UI library |
| TypeScript | 5.x | Type-safe development |

### Backend & Database
| Technology | Purpose |
|------------|---------|
| Convex | Serverless backend, real-time database, functions |
| Liveblocks | Real-time collaboration, presence, comments |
| Clerk | Authentication, organizations, user management |

### Editor
| Technology | Purpose |
|------------|---------|
| TipTap 2.10 | Rich text editor framework (based on ProseMirror) |
| Lowlight | Code syntax highlighting |

### AI & Search
| Technology | Purpose |
|------------|---------|
| OpenAI API | AI content generation (gpt-4o-mini) |
| Cerebras API | Alternative AI inference (llama3.1-8b) |
| Tinyfish | Web search via DuckDuckGo |

### UI & Styling
| Technology | Purpose |
|------------|---------|
| Tailwind CSS | Utility-first CSS framework |
| shadcn/ui | High-quality Radix UI components |
| Lucide React | Icon library |
| Sonner | Toast notifications |
| next-themes | Dark mode support |

### State Management
| Technology | Purpose |
|------------|---------|
| Zustand | Editor instance state |
| nuqs | URL search params state |
| React Hook Form | Form state management |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Next.js App Router                           │    │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐    │    │
│  │  │  Home Page   │  │  Document Editor │  │  Components (UI)   │    │    │
│  │  │  - Templates │  │  - TipTap Editor │  │  - shadcn/ui       │    │    │
│  │  │  - Doc Table │  │  - Toolbar       │  │  - Dialogs         │    │    │
│  │  │  - Search    │  │  - Comments      │  │  - Menus           │    │    │
│  │  └──────────────┘  │  - Ruler         │  └────────────────────┘    │    │
│  │                    └──────────────────┘                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                    │                    │                    │               │
│         Convex React           Liveblocks React        Zustand Store        │
│              │                         │                     │               │
└──────────────┼─────────────────────────┼─────────────────────┼───────────────┘
               │                         │                     │
               ▼                         ▼                     │
┌──────────────────────────┐  ┌──────────────────────────┐    │
│      CONVEX BACKEND      │  │       LIVEBLOCKS         │    │
│  ┌────────────────────┐  │  │  ┌──────────────────┐   │    │
│  │  documents table   │  │  │  │  Collaboration   │   │    │
│  │  - title           │  │  │  │  - Cursors       │   │    │
│  │  - initialContent  │  │  │  │  - Presence      │   │    │
│  │  - ownerId         │  │  │  │  - Comments      │   │    │
│  │  - organizationId  │  │  │  │  - Storage       │   │    │
│  │  - roomId          │  │  │  └──────────────────┘   │    │
│  └────────────────────┘  │  └──────────────────────────┘    │
│  ┌────────────────────┐  │             ▲                    │
│  │  Mutations/Queries │  │             │ Auth Token         │
│  └────────────────────┘  │             │                    │
└──────────────────────────┘  ┌──────────┴───────────────────┐│
               ▲              │    /api/liveblocks-auth      ││
               │              └──────────────────────────────┘│
               │                         ▲                    │
               │                         │                    │
┌──────────────┴─────────────────────────┴────────────────────┴───────────────┐
│                              CLERK AUTH                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  User Sessions  │  │  Organizations  │  │  JWT Tokens (to Convex)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
│  ┌──────────────────────────┐      ┌──────────────────────────────────┐    │
│  │       OpenAI API         │      │         Tinyfish API             │    │
│  │  - /api/llm              │      │  - /api/search                   │    │
│  │  - /api/llm/stream       │      │  - /api/search/stream            │    │
│  │  - gpt-4o-mini model     │      │  - DuckDuckGo search             │    │
│  │  - /lekha <prompt>       │      │  - /search <query>               │    │
│  └──────────────────────────┘      └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
RootLayout (layout.tsx)
├── ConvexClientProvider
│   └── ClerkProvider + ConvexProviderWithClerk
├── NuqsAdapter (URL state)
├── Toaster (notifications)
│
├── Home Page (/)
│   ├── Navbar
│   │   ├── Logo
│   │   ├── SearchInput
│   │   ├── UserButton (Clerk)
│   │   └── OrganizationSwitcher
│   ├── TemplatesGallery
│   │   └── Carousel of template cards
│   └── DocumentsTable
│       └── DocumentRow
│           └── DocumentMenu (rename/delete)
│
└── Document Editor (/documents/[documentId])
    └── Document
        └── Room (LiveblocksProvider + RoomProvider)
            ├── Navbar
            │   ├── DocumentInput (title)
            │   ├── Menubar (File, Edit, Insert, Format)
            │   ├── Avatars (collaborators)
            │   └── Inbox (notifications)
            ├── Toolbar
            │   ├── FontFamilyButton
            │   ├── HeadingLevelButton
            │   ├── FontSizeButton
            │   ├── TextColorButton
            │   ├── HighlightColorButton
            │   ├── LinkButton
            │   ├── ImageButton
            │   ├── AlignButton
            │   └── LineHeightButton
            └── Editor (TipTap)
                ├── Ruler
                └── Threads (comments)
```

---

## Project Structure

```
lekha/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── (home)/                       # Home page route group
│   │   │   ├── page.tsx                  # Dashboard page
│   │   │   ├── navbar.tsx                # Top navigation
│   │   │   ├── documents-table.tsx       # Document listing with pagination
│   │   │   ├── document-row.tsx          # Single document row
│   │   │   ├── document-menu.tsx         # Context menu (rename/delete)
│   │   │   ├── templates-gallery.tsx     # Template carousel
│   │   │   └── search-input.tsx          # Search documents
│   │   │
│   │   ├── documents/
│   │   │   ├── page.tsx                  # Documents list (minimal)
│   │   │   └── [documentId]/             # Dynamic document route
│   │   │       ├── page.tsx              # Server component (preload)
│   │   │       ├── document.tsx          # Client wrapper
│   │   │       ├── room.tsx              # Liveblocks room provider
│   │   │       ├── editor.tsx            # TipTap editor (main)
│   │   │       ├── navbar.tsx            # Document header/menubar
│   │   │       ├── toolbar.tsx           # Formatting toolbar
│   │   │       ├── ruler.tsx             # Document ruler
│   │   │       ├── threads.tsx           # Comments UI
│   │   │       ├── inbox.tsx             # Notifications dropdown
│   │   │       ├── avatars.tsx           # Collaborator avatars
│   │   │       ├── document-input.tsx    # Title input
│   │   │       └── action.ts             # Server actions
│   │   │
│   │   ├── api/
│   │   │   ├── liveblocks-auth/          # Liveblocks authentication
│   │   │   │   └── route.ts
│   │   │   ├── llm/                      # OpenAI integration
│   │   │   │   ├── route.ts              # Non-streaming
│   │   │   │   └── stream/route.ts       # Streaming SSE
│   │   │   └── search/                   # Tinyfish search
│   │   │       ├── route.ts              # Non-streaming
│   │   │       └── stream/route.ts       # Streaming SSE
│   │   │
│   │   ├── layout.tsx                    # Root layout
│   │   ├── globals.css                   # Global styles
│   │   └── error.tsx                     # Error boundary
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn/ui components (40+)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   └── ... (many more)
│   │   ├── convex-client-provider.tsx    # Auth + DB provider
│   │   ├── fullscreen-loader.tsx         # Loading spinner
│   │   ├── remove-dialog.tsx             # Delete confirmation
│   │   └── rename-dialog.tsx             # Rename modal
│   │
│   ├── extensions/                       # Custom TipTap extensions
│   │   ├── font-size.ts                  # Font size control
│   │   ├── line-height.ts                # Line height control
│   │   ├── llm-command.ts                # /lekha and /search commands
│   │   └── llm-accordion.tsx             # AI response accordion UI
│   │
│   ├── hooks/                            # Custom React hooks
│   │   ├── use-debounce.ts
│   │   ├── use-mobile.tsx
│   │   ├── use-search-param.ts
│   │   └── use-toast.ts
│   │
│   ├── constants/
│   │   ├── margins.ts                    # Default page margins
│   │   └── templates.ts                  # Document templates
│   │
│   ├── lib/
│   │   ├── tinyfish-search.ts            # Search utilities
│   │   └── utils.ts                      # cn() helper
│   │
│   ├── store/
│   │   └── use-editor-store.ts           # Zustand editor state
│   │
│   └── middleware.ts                     # Clerk auth middleware
│
├── convex/                               # Convex backend
│   ├── schema.ts                         # Database schema
│   ├── documents.ts                      # Document CRUD operations
│   ├── auth.config.ts                    # Clerk integration
│   └── _generated/                       # Auto-generated types
│
├── public/                               # Static assets
│   ├── logo.svg
│   ├── templates/                        # Template preview images
│   └── demo.gif
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── liveblocks.config.ts                  # Liveblocks types
└── components.json                       # shadcn/ui config
```

---

## Page Summaries

### 1. Home Page (`/`)

**File:** `src/app/(home)/page.tsx`

**Purpose:** Main dashboard for viewing and managing documents.

**Features:**
- Hero section with tagline and gradient background
- Template gallery carousel with 7 pre-built templates
- Documents table with pagination (load more)
- Search documents by title
- Create new document from template or blank
- View document metadata (created date, org/personal)

**Key Components:**
| Component | Purpose |
|-----------|---------|
| `Navbar` | Logo, search input, user button, org switcher |
| `TemplatesGallery` | Horizontal carousel of document templates |
| `DocumentsTable` | Paginated table of user's documents |
| `DocumentRow` | Single row with title, org indicator, date, menu |
| `DocumentMenu` | Dropdown with rename, delete, open in new tab |

---

### 2. Document Editor (`/documents/[documentId]`)

**File:** `src/app/documents/[documentId]/page.tsx`

**Purpose:** Full-featured collaborative document editing interface.

**Features:**
- Real-time collaborative editing with live cursors
- Rich text formatting (bold, italic, colors, fonts, etc.)
- Tables, images, code blocks, task lists
- Comments and threaded discussions
- AI content generation (`/lekha <prompt>`)
- Web search insertion (`/search <query>`)
- Document ruler with adjustable margins
- Export to JSON, HTML, PDF, or text
- Print support

**Key Components:**
| Component | Purpose |
|-----------|---------|
| `Room` | Liveblocks provider for real-time collaboration |
| `Editor` | TipTap editor with 15+ extensions |
| `Navbar` | Document title, menubar (File/Edit/Insert/Format), avatars, inbox |
| `Toolbar` | Formatting buttons (font, size, color, alignment, etc.) |
| `Ruler` | Word processor-style ruler with draggable margins |
| `Threads` | Floating comments and discussion threads |
| `Avatars` | Shows active collaborators with presence |
| `Inbox` | Notifications dropdown (comments, mentions) |

---

### 3. Documents List (`/documents`)

**File:** `src/app/documents/page.tsx`

**Purpose:** Placeholder page (minimal implementation).

**Current State:** Displays "Documents Page" text only.

---

## Key Features

### 1. Rich Text Editing

Powered by TipTap with extensive formatting options:

**Text Formatting:**
- Bold, Italic, Underline, Strikethrough
- Text color (with color picker)
- Highlight/background color
- Font family (Arial, Times New Roman, Courier New, Georgia, Verdana)
- Font size (with increment/decrement)
- Line height (1.0, 1.15, 1.5, 2.0)

**Block Elements:**
- Headings (H1-H5) with custom sizes
- Paragraphs with alignment (left, center, right, justify)
- Bullet lists and numbered lists
- Task lists with checkboxes
- Code blocks with syntax highlighting
- Tables with row/column manipulation
- Images (upload or URL with resize)
- Links with auto-linking

### 2. Real-Time Collaboration

Powered by Liveblocks:

- **Live Cursors:** See other users' cursor positions
- **Presence:** Know who's currently viewing the document
- **Awareness:** User metadata (name, avatar, color)
- **Comments:** Threaded discussions anchored to text
- **Storage:** Shared state (margins) across all users

### 3. AI Integration

**`/lekha <prompt>` Command:**
- Type `/lekha` followed by your prompt in the editor
- Sends request to OpenAI API (gpt-4o-mini)
- Streams response and inserts as expandable accordion
- Supports context from parent accordions

**`/search <query>` Command:**
- Type `/search` followed by your query
- Searches the web via Tinyfish (DuckDuckGo)
- Returns answer with top 5 search results
- Formatted with titles, URLs, and snippets

### 4. Document Templates

7 pre-built templates available:

1. **Blank Document** - Empty canvas
2. **Software Development Proposal** - Project plan with sections
3. **Project Proposal** - Executive summary, methodology, timeline
4. **Business Letter** - Professional correspondence format
5. **Resume** - CV with experience, education, skills sections
6. **Cover Letter** - Job application letter
7. **Letter** - General letter format

### 5. Export Options

From the File menu:
- **JSON** - TipTap editor state (for backup/restore)
- **HTML** - Web-ready HTML file
- **PDF** - Print to PDF via browser
- **Text** - Plain text content

### 6. Organization Support

- Personal documents (owned by user)
- Organization documents (shared with team members)
- Organization switcher in navbar
- Access control based on ownership or org membership

---

## Data Flow

### Authentication Flow

```
1. User visits Lekha
       │
       ▼
2. Clerk Middleware checks session
       │
       ├─── Not authenticated ──► Redirect to sign-in
       │
       ▼
3. Authenticated user
       │
       ▼
4. ConvexProviderWithClerk syncs auth
       │
       ▼
5. User can access documents based on:
   - ownerId matches user.id
   - organizationId matches user's org
```

### Document Creation Flow

```
1. User clicks template or "Blank Document"
       │
       ▼
2. Convex mutation: documents.create
       │
       ├── Extract user identity from Clerk token
       ├── Get organizationId from token (if org selected)
       ├── Insert document record
       └── Return document._id
       │
       ▼
3. Redirect to /documents/{documentId}
       │
       ▼
4. Document page loads
       │
       ▼
5. Room component connects to Liveblocks
       │
       ├── POST /api/liveblocks-auth
       ├── Validate user access to document
       └── Return session token
       │
       ▼
6. Editor mounts with real-time sync
```

### Real-Time Editing Flow

```
1. User types in editor
       │
       ▼
2. TipTap Collaboration extension
       │
       ▼
3. Liveblocks syncs changes
       │
       ├── Y.js CRDT operations
       ├── Broadcast to other users
       └── Update presence (cursor position)
       │
       ▼
4. Other users see changes instantly
```

### AI Generation Flow

```
1. User types: /lekha explain quantum computing
       │
       ▼
2. LlmCommandExtension triggers
       │
       ├── Extract prompt
       ├── Create accordion placeholder
       └── POST /api/llm/stream
       │
       ▼
3. API route calls OpenAI
       │
       ├── Model: gpt-4o-mini
       └── Stream response via SSE
       │
       ▼
4. Client receives chunks
       │
       ├── Parse SSE data
       ├── Update accordion content
       └── Convert markdown to TipTap nodes
       │
       ▼
5. Final content rendered in accordion
```

---

## API Routes

### `/api/liveblocks-auth`

**Method:** POST

**Purpose:** Authenticate users for Liveblocks collaboration.

**Flow:**
1. Get current user from Clerk
2. Fetch document from Convex
3. Verify user is owner or org member
4. Issue Liveblocks session token with user info

**Response:** Liveblocks session token

---

### `/api/llm`

**Method:** POST

**Purpose:** Generate content with OpenAI (non-streaming).

**Request Body:**
```json
{
  "prompt": "Write a summary of...",
  "model": "gpt-4o-mini"
}
```

**Response:**
```json
{
  "text": "Generated content..."
}
```

---

### `/api/llm/stream`

**Method:** POST

**Purpose:** Generate content with OpenAI (streaming).

**Request Body:**
```json
{
  "prompt": "Write a summary of..."
}
```

**Response:** Server-Sent Events stream

---

### `/api/search`

**Method:** POST

**Purpose:** Search the web via Tinyfish (non-streaming).

**Request Body:**
```json
{
  "query": "search term"
}
```

**Response:**
```json
{
  "answer": "Summary answer...",
  "results": [
    { "title": "...", "url": "...", "snippet": "..." }
  ]
}
```

---

### `/api/search/stream`

**Method:** POST

**Purpose:** Search the web via Tinyfish (streaming).

**Request Body:**
```json
{
  "query": "search term"
}
```

**Response:** Server-Sent Events stream

---

## Database Schema

### Convex Schema (`convex/schema.ts`)

```typescript
documents: defineTable({
  title: v.string(),              // Document title
  initialContent: v.optional(v.string()),  // Initial TipTap JSON content
  ownerId: v.string(),            // Clerk user ID
  roomId: v.optional(v.string()), // Liveblocks room ID (same as doc ID)
  organizationId: v.optional(v.string()),  // Clerk organization ID
})
  .index("by_owner_id", ["ownerId"])
  .index("by_organization_id", ["organizationId"])
  .searchIndex("search_title", {
    searchField: "title",
    filterFields: ["ownerId", "organizationId"],
  })
```

### Document Mutations

| Mutation | Purpose |
|----------|---------|
| `documents.create` | Create new document |
| `documents.removeById` | Delete document by ID |
| `documents.updateById` | Update document title |
| `documents.getById` | Get single document |
| `documents.get` | Paginated list with search |
| `documents.getByIds` | Batch fetch by IDs |

---

## Environment Variables

```env
# Convex Database
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=dev:your-project

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Liveblocks Real-time
LIVEBLOCKS_SECRET_KEY=sk_dev_...

# OpenAI (for /lekha command)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini

# Cerebras (alternative AI provider)
CEREBRAS_API_KEY=csk-...
CEREBRAS_MODEL=llama3.1-8b  # Optional, defaults to llama3.1-8b

# Tinyfish Search (for /search command)
TINYFISH_API_KEY=sk-tinyfish-...
```

---

## Development

### Getting Started

```bash
# Install dependencies
npm install

# Run Convex backend
npx convex dev

# Run Next.js development server
npm run dev
```

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## License

This project is proprietary software.
