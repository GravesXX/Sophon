---
name: profile
description: View or edit your personality profile
user-invocable: true
---

# Personality Profile

When the user invokes /profile:

- **No arguments**: Call sophon_personality_get and display the full profile
- **"edit"**: Ask the user which trait they want to modify, then update it
- **"reset"**: Confirm with the user, then clear all personality data
