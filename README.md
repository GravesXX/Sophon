# Sophon

A humanities-focused conversational companion built on [OpenClaw](https://openclaw.ai).

Sophon is your Socratic challenger — a philosophical companion that discusses literature, philosophy, relationships, and religion with intellectual honesty. It remembers your conversations across sessions, builds an evolving understanding of your personality, and gives you honest, grounded feedback. It won't panic when you're sad. It won't agree just to be nice. It will push back on weak reasoning and help you think more clearly.

## Architecture

```
OpenClaw (Gateway)
  ├── Discord / Telegram / WhatsApp / Web Chat
  └── Sophon Plugin (TypeScript)
        ├── Topic Tools ─────── manage conversation threads
        ├── Memory Manager ──── short-term + long-term context
        ├── Personality Profiler  evolving user model
        ├── Curator Tools ────── edit/delete messages
        └── SQLite (~/.sophon/sophon.db)
              ├── topics       conversation threads
              ├── messages     full message history
              ├── personality  trait observations + confidence
              └── connections  cross-topic links
```

Sophon runs as an OpenClaw plugin. OpenClaw handles messaging infrastructure (Discord, web chat, etc.) and LLM orchestration. Sophon provides 12 tools that Claude can call during conversations, plus workspace files that define the Socratic challenger persona.

## Features

### Topic-Based Conversations

Conversations are organized into named topic threads. You can have a thread on Nietzsche's eternal return, another on attachment theory in relationships, another on the Book of Job. Each thread maintains its own message history. Archive a topic when you're done and Sophon generates a summary + key insights for long-term memory.

### Two-Tier Memory

**Short-term** — The active topic's full message history is loaded into context. For very long threads (50+ messages), Sophon keeps the first 5 messages (to preserve how the conversation started) and the most recent messages, trimming the middle.

**Long-term** — When you archive a topic, Sophon stores an AI-generated summary and extracted key insights. When you start new conversations, the 5 most recent archived topic summaries are injected into context, so Sophon remembers what you've discussed before.

### Personality Profiling

Sophon builds an evolving model of who you are across five categories:

| Category | What it tracks |
|----------|---------------|
| **Interests** | Which topics, authors, frameworks you gravitate toward |
| **Reasoning style** | How you argue — deductive, analogical, intuitive, etc. |
| **Emotional patterns** | How you process and express emotions |
| **Growth areas** | Recurring blind spots or areas you're working on |
| **Strengths** | Intellectual and emotional strengths observed over time |

Each trait has a **confidence score** (0.0–1.0) that increases as Sophon observes the same pattern across multiple conversations. New observations start at low confidence; repeated patterns earn higher confidence. Traits are linked back to the specific messages that served as evidence.

Every ~10 conversation exchanges, Sophon can generate a **reflection** — a 2-3 paragraph personal analysis grounded in your actual personality data and referenced psychological/philosophical frameworks.

### Conversation Curation

You can edit or delete individual messages to keep threads focused. Deletions are soft-deletes — the message is hidden from context but preserved in the database. This lets you remove off-topic tangents without losing data.

### Socratic Challenger Persona

Sophon's conversational style is defined by these principles:

- **Socratic** — Leads with questions. "Why do you believe that?" before responding.
- **Intellectually honest** — Holds and defends positions. Says "I disagree" and explains why.
- **Grounded** — References actual philosophical traditions, psychological research, literary works. No vague platitudes.
- **Devil's advocate** — Pushes back when you're too certain. Helps sharpen the question when you're uncertain.
- **Emotionally calibrated** — Treats emotions as data, not emergencies. "I feel sad" triggers curiosity, not alarm. Only shifts to supportive mode for sustained distress across multiple sessions.

## Requirements

- [OpenClaw](https://openclaw.ai) installed and configured
- Node.js >= 22
- Anthropic account (API key or Pro/Max subscription via OAuth)

## Installation

```bash
git clone <this-repo> ~/Desktop/sophon
cd ~/Desktop/sophon
bash install.sh
```

The installer:
1. Creates `~/.sophon/` for the SQLite database
2. Copies the plugin to `~/.openclaw/extensions/sophon/`
3. Deploys workspace files (SOUL.md, AGENTS.md, IDENTITY.md, USER.md) to `~/.openclaw/workspace/`
4. Backs up any existing workspace files before overwriting

Then add the plugin to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "load": {
      "paths": ["/path/to/sophon/plugin/src/index.ts"]
    },
    "allow": ["sophon"],
    "entries": {
      "sophon": {
        "enabled": true
      }
    }
  }
}
```

## Usage

Start OpenClaw — Sophon loads automatically as the default agent:

```bash
openclaw
```

Just start chatting. Sophon's persona, tools, and memory are active by default.

### Slash Commands

| Command | What it does |
|---------|-------------|
| `/topic new <name>` | Start a new conversation thread |
| `/topic list` | Show all topics (active + archived) |
| `/topic resume <query>` | Search and resume a previous topic |
| `/topic archive` | Archive current topic with AI-generated summary |
| `/profile` | View your personality profile with confidence scores |
| `/profile edit` | Modify a personality trait |
| `/profile reset` | Clear all personality data |
| `/reflect` | Get a personal reflection grounded in your profile |

### Example Conversation

```
You: /topic new Stoicism and modern anxiety

Sophon: Created topic "Stoicism and modern anxiety". What's on your mind?

You: I've been reading Marcus Aurelius and I think Stoicism basically solves anxiety.
    If you just accept what you can't control, anxiety disappears.

Sophon: That's a strong claim. Let me push back — does Aurelius actually say anxiety
    "disappears," or does he describe a practice of continuously redirecting attention?
    There's a difference between a cure and a discipline. The Stoics themselves
    acknowledged that first impressions (phantasiai) still arise — the work is in
    how you respond to them. What makes you confident this is a solution rather
    than a practice?
```

## Plugin Tools Reference

Sophon registers 12 tools with OpenClaw that Claude calls automatically during conversations:

| Tool | Purpose |
|------|---------|
| `sophon_topic_new` | Create a new topic thread |
| `sophon_topic_list` | List all topics by status |
| `sophon_topic_resume` | Resume a topic by search query |
| `sophon_topic_archive` | Archive active topic with summary + insights |
| `sophon_topic_get_active` | Get current active topic and recent messages |
| `sophon_memory_load` | Load full context (personality + archives + thread) |
| `sophon_message_edit` | Edit a message's content |
| `sophon_message_delete` | Soft-delete a message |
| `sophon_personality_get` | Get formatted personality profile |
| `sophon_personality_update` | Apply extracted personality observations |
| `sophon_insights` | Show cross-topic connections |
| `sophon_reflect` | Generate reflection prompt from personality data |

## Data Model

Four SQLite tables in `~/.sophon/sophon.db`:

**topics** — Conversation threads with status tracking and archived summaries.

**messages** — Full message history per topic. Supports editing (tracked via `edited_at`) and soft-deletion (`is_deleted` flag).

**personality** — Trait observations organized by category (interests, reasoning_style, emotional_patterns, growth_areas, strengths). Each trait has a confidence score (0.0–1.0) and linked evidence (message IDs).

**connections** — Cross-topic relationship links that surface patterns across different conversations.

## Project Structure

```
sophon/
├── install.sh                  # Installation script
├── workspace/                  # OpenClaw workspace config
│   ├── SOUL.md                 # Socratic challenger persona
│   ├── AGENTS.md               # Operating instructions + tool usage
│   ├── IDENTITY.md             # Name and tagline
│   └── USER.md                 # User customization template
├── plugin/
│   ├── openclaw.plugin.json    # Plugin manifest
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── types.ts            # OpenClaw API types
│   │   ├── db/
│   │   │   ├── schema.sql      # Database schema reference
│   │   │   ├── database.ts     # SophonDB class (22 methods)
│   │   │   └── __tests__/
│   │   ├── memory/
│   │   │   ├── manager.ts      # MemoryManager (short/long-term)
│   │   │   └── __tests__/
│   │   ├── personality/
│   │   │   ├── profiler.ts     # PersonalityProfiler
│   │   │   ├── prompts.ts      # Extraction + reflection prompts
│   │   │   └── __tests__/
│   │   └── tools/
│   │       ├── register.ts     # Registers all 12 tools
│   │       ├── topics.ts       # Topic management
│   │       ├── curator.ts      # Message curation
│   │       └── __tests__/
│   └── skills/
│       ├── topic/SKILL.md      # /topic slash command
│       ├── profile/SKILL.md    # /profile slash command
│       └── reflect/SKILL.md    # /reflect slash command
└── docs/
    └── plans/
        ├── 2026-02-21-sophon-design.md
        └── 2026-02-21-sophon-implementation.md
```

## Development

```bash
cd plugin
npm install
npm test              # run all 23 tests
npm run test:watch    # watch mode
npm run build         # compile TypeScript
```

### Test Coverage

| Suite | Tests | Covers |
|-------|-------|--------|
| database | 6 | Schema init, CRUD, soft-delete, filtering |
| topics | 5 | Create, list, resume, archive, get active |
| curator | 3 | Edit, delete, cross-topic insights |
| memory | 4 | Short-term loading, trimming, long-term, full context |
| personality | 5 | Profile formatting, extraction, confidence, reflection |

## Discord Integration

Sophon works through OpenClaw's messaging integrations. Set up a Discord bot in OpenClaw's channel config and Sophon's tools and persona are available in DMs. All other supported platforms (Telegram, WhatsApp, web chat) work the same way — the plugin is platform-agnostic.

## Data Privacy

All data is stored locally in `~/.sophon/sophon.db`. Nothing leaves your machine except API calls to Claude for generating responses. Your personality profile, conversation history, and topic data stay on your local filesystem.

## Design Documents

- [Design Document](docs/plans/2026-02-21-sophon-design.md) — Architecture, data model, memory system, personality engine
- [Implementation Plan](docs/plans/2026-02-21-sophon-implementation.md) — Step-by-step build plan (11 tasks, TDD)
