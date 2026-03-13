---
name: topic
description: Manage conversation topics - create, list, resume, or archive
user-invocable: true
---

# Topic Management

When the user invokes /topic, determine the action from their message:

- **"new [title]"**: Call sophon_topic_new with the given title
- **"list"**: Call sophon_topic_list
- **"resume [query]"**: Call sophon_topic_resume with the search query
- **"archive"**: First generate a summary and key insights from the current conversation, then call sophon_topic_archive

If no action is specified, call sophon_topic_list to show available topics.
