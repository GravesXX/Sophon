# Sophon Design Document

**Date:** 2026-02-21
**Project:** Sophon — A Humanities-Focused Conversational Companion with Memory

## Overview

Sophon is a personal AI conversational companion built on top of OpenClaw, focused on humanities topics (philosophy, literature, romantic relationships, religion). It features a topic-based memory system, an evolving personality profiler, and a Socratic challenger conversation style powered by Claude.

## Architecture

Sophon is an OpenClaw custom agent/plugin. OpenClaw handles messaging infrastructure (Discord, local web chat, etc.). Sophon handles:

- **Topic Router** — routes messages to conversation threads
- **Memory Manager** — short-term (active thread) and long-term (summaries, insights)
- **Personality Profiler** — evolving understanding of the user
- **Conversation Curator** — edit, delete, merge messages and topics
- **Humanities System Prompt** — Socratic challenger persona

```
OpenClaw (Gateway + Discord/Local Chat/WebChat)
  └── Sophon Agent (custom plugin)
        ├── Topic Router
        ├── Memory Manager (short/long term)
        ├── Personality Profiler
        ├── Conversation Curator
        └── Humanities System Prompt
              └── Claude API (Anthropic)
                    └── Local SQLite (~/.sophon/sophon.db)
```

## Tech Stack

- **Platform:** OpenClaw (Node.js/TypeScript)
- **LLM:** Claude (Anthropic API)
- **Storage:** Local SQLite
- **Discord:** Via OpenClaw's built-in discord.js integration
- **Local Chat:** Via OpenClaw's WebChat UI

## Data Model

### Topics
Each conversation thread belongs to a named topic.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| title | TEXT | Human-readable topic name |
| status | TEXT | 'active' or 'archived' |
| created_at | DATETIME | When created |
| updated_at | DATETIME | Last activity |
| summary | TEXT | AI-generated long-term summary |
| key_insights | TEXT (JSON) | Extracted insights array |

### Messages
Editable conversation history within topics.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| topic_id | TEXT FK | References topics |
| role | TEXT | 'user' or 'assistant' |
| content | TEXT | Message text |
| created_at | DATETIME | When sent |
| edited_at | DATETIME | NULL if never edited |
| is_deleted | INTEGER | Soft delete flag |

### Personality
Evolving personality profile with confidence tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| category | TEXT | interests, reasoning_style, emotional_patterns, growth_areas, strengths |
| key | TEXT | Specific trait name |
| value | TEXT | Observation text |
| confidence | REAL | 0.0-1.0, increases with evidence |
| evidence | TEXT (JSON) | References to source messages |
| updated_at | DATETIME | Last updated |

### Connections
Cross-topic insight links.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| topic_a_id | TEXT FK | References topics |
| topic_b_id | TEXT FK | References topics |
| relationship | TEXT | Description of the connection |
| created_at | DATETIME | When identified |

## Memory System

### Short-term Memory
- Full message history of the active topic thread
- Loaded into Claude's context window as conversation history
- Sliding window trimming for very long threads (keeps first + most recent, summarizes middle)

### Long-term Memory
- Generated when topics are archived (or periodically):
  - Topic summary (2-3 paragraphs)
  - Key insights (bullet points)
  - Personality observations
- Injected into new conversations:
  - Top 3-5 relevant topic summaries (by similarity)
  - Current personality profile
  - Relevant cross-topic connections

### Memory Injection Flow
```
New message → Identify topic → Load short-term (thread messages)
  → Load long-term (relevant summaries, top 3-5)
  → Load personality profile
  → Construct prompt (system + memory + message)
  → Send to Claude → Store response
  → (Async) Update personality if new signal detected
```

## Personality Engine

Runs asynchronously after each conversation turn:

1. **Observation extraction** — Claude identifies personality-relevant signals
2. **Profile update** — merges observations, adjusts confidence scores
3. **Periodic reflection** — every ~10 conversations, generates a "state of mind" reflection

### Emotional Intelligence Principles
- Emotions are data points, not emergencies
- "I feel sad" triggers curiosity, not alarm
- Distinguishes current state expression from distress signaling
- Escalates only for sustained distress patterns across multiple sessions

### Intellectual Honesty Principles
- Challenges weak arguments directly
- Maintains and defends its own philosophical positions
- Plays devil's advocate when user is too certain
- Says "I disagree" and explains why
- Rates argument strength when relevant

## Conversation Curation Commands

| Command | Description |
|---------|-------------|
| `/topic new <name>` | Start a new thread |
| `/topic list` | Show all topics with status |
| `/topic resume <name>` | Continue a previous thread |
| `/topic archive` | Archive current, trigger summary |
| `/edit <msg_id>` | Edit a past message |
| `/delete <msg_id>` | Soft-delete off-topic message |
| `/profile` | View personality profile |
| `/profile edit` | Modify a trait |
| `/insights` | View cross-topic insights |
| `/reflect` | Trigger personality reflection |

## Conversation Style

Socratic challenger: asks probing questions, challenges weak reasoning, plays devil's advocate. Respects the user enough to push back. Grounded in actual philosophical and psychological frameworks.
