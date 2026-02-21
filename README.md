# Sophon

A humanities-focused conversational companion built on [OpenClaw](https://github.com/openclaw/openclaw).

Sophon is your Socratic challenger - a philosophical companion that discusses literature, philosophy, relationships, and religion with intellectual honesty. It remembers your conversations, builds an understanding of your personality over time, and gives you honest feedback.

## Features

- **Topic-based conversations** - Organize discussions into named threads
- **Short-term and long-term memory** - Full context in active threads, summarized insights from past ones
- **Personality profiling** - Evolving understanding of your intellectual interests, reasoning style, and emotional patterns
- **Conversation curation** - Edit or remove off-topic messages to keep threads focused
- **Socratic challenger** - Pushes back on weak reasoning, plays devil's advocate, never just agrees
- **Emotionally grounded** - Treats emotions as data, not emergencies

## Requirements

- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- Node.js >= 22
- An Anthropic API key (for Claude)

## Installation

```bash
git clone <this-repo> ~/Desktop/sophon
cd ~/Desktop/sophon
bash install.sh
```

## Usage

Start OpenClaw normally - Sophon loads as a plugin:

```bash
openclaw
```

### Commands

| Command | Description |
|---------|-------------|
| /topic new <name> | Start a new conversation thread |
| /topic list | Show all topics |
| /topic resume <query> | Resume a previous topic |
| /topic archive | Archive current topic with summary |
| /profile | View your personality profile |
| /profile edit | Modify personality traits |
| /reflect | Get a personal reflection |

### Discord

Sophon works through OpenClaw's Discord integration. Set up a Discord bot via OpenClaw's channel config, and Sophon's tools and persona are available in DMs.

## Data

All data is stored locally at ~/.sophon/sophon.db (SQLite). Nothing leaves your machine except API calls to Claude.

## Development

```bash
cd plugin
npm install
npm test          # run tests
npm run build     # compile TypeScript
```
