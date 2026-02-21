import path from 'path';
import os from 'os';
import { SophonDB } from '../db/database.js';
import { TopicTools } from './topics.js';
import { CuratorTools } from './curator.js';
import { MemoryManager } from '../memory/manager.js';
import { PersonalityProfiler } from '../personality/profiler.js';
import type { PluginAPI } from '../types.js';

export function registerAllTools(api: PluginAPI): void {
  const dbPath = path.join(os.homedir(), '.sophon', 'sophon.db');
  const db = new SophonDB(dbPath);

  const topics = new TopicTools(db);
  const curator = new CuratorTools(db);
  const memory = new MemoryManager(db);
  const profiler = new PersonalityProfiler(db);

  // ── Topic Tools ──────────────────────────────────────────────────────────

  api.registerTool({
    name: 'sophon_topic_new',
    description: 'Create a new conversation topic',
    parameters: {
      title: {
        type: 'string',
        description: 'Title for the new topic',
        required: true,
      },
    },
    run: async (params) => {
      return topics.newTopic({ title: params.title as string });
    },
  });

  api.registerTool({
    name: 'sophon_topic_list',
    description: 'List all topics grouped by status',
    parameters: {},
    run: async (params) => {
      return topics.listTopics(params);
    },
  });

  api.registerTool({
    name: 'sophon_topic_resume',
    description: 'Resume a previous topic by searching for it',
    parameters: {
      query: {
        type: 'string',
        description: 'Search query to find the topic by title',
        required: true,
      },
    },
    run: async (params) => {
      return topics.resumeTopic({ query: params.query as string });
    },
  });

  api.registerTool({
    name: 'sophon_topic_archive',
    description: 'Archive the currently active topic with a summary and key insights',
    parameters: {
      summary: {
        type: 'string',
        description: 'Summary of the conversation',
        required: true,
      },
      key_insights: {
        type: 'string',
        description: 'JSON array of key insights from the conversation',
        required: true,
      },
    },
    run: async (params) => {
      let insights: string[] | undefined;
      try {
        insights = JSON.parse(params.key_insights as string);
      } catch {
        insights = undefined;
      }
      return topics.archiveTopic({
        summary: params.summary as string,
        key_insights: insights,
      });
    },
  });

  api.registerTool({
    name: 'sophon_topic_get_active',
    description: 'Get the currently active topic with recent messages',
    parameters: {},
    run: async (params) => {
      return topics.getActive(params);
    },
  });

  // ── Memory Tools ─────────────────────────────────────────────────────────

  api.registerTool({
    name: 'sophon_memory_load',
    description: 'Load context memory for a topic including personality, long-term memories, and current topic',
    parameters: {
      topic_id: {
        type: 'string',
        description: 'ID of the topic to load memory for',
        required: true,
      },
    },
    run: async (params) => {
      const content = memory.buildContextPrompt(params.topic_id as string);
      return { content };
    },
  });

  // ── Curator Tools ────────────────────────────────────────────────────────

  api.registerTool({
    name: 'sophon_message_edit',
    description: 'Edit the content of a specific message',
    parameters: {
      message_id: {
        type: 'string',
        description: 'ID of the message to edit',
        required: true,
      },
      new_content: {
        type: 'string',
        description: 'New content for the message',
        required: true,
      },
    },
    run: async (params) => {
      return curator.editMessage({
        message_id: params.message_id as string,
        new_content: params.new_content as string,
      });
    },
  });

  api.registerTool({
    name: 'sophon_message_delete',
    description: 'Delete a specific message',
    parameters: {
      message_id: {
        type: 'string',
        description: 'ID of the message to delete',
        required: true,
      },
    },
    run: async (params) => {
      return curator.deleteMessage({
        message_id: params.message_id as string,
      });
    },
  });

  // ── Personality Tools ────────────────────────────────────────────────────

  api.registerTool({
    name: 'sophon_personality_get',
    description: 'Get the current personality profile',
    parameters: {},
    run: async () => {
      const content = profiler.formatProfile();
      return { content };
    },
  });

  api.registerTool({
    name: 'sophon_personality_update',
    description: 'Update personality profile with extracted observations from a conversation',
    parameters: {
      extraction_json: {
        type: 'string',
        description: 'JSON string containing personality extraction results',
        required: true,
      },
      message_ids: {
        type: 'string',
        description: 'JSON array of message IDs used as evidence',
        required: true,
      },
    },
    run: async (params) => {
      const messageIds: string[] = JSON.parse(params.message_ids as string);
      profiler.applyExtraction(params.extraction_json as string, messageIds);
      return { content: 'Personality profile updated.' };
    },
  });

  api.registerTool({
    name: 'sophon_insights',
    description: 'Show cross-topic insights and connections',
    parameters: {},
    run: async (params) => {
      return curator.showInsights(params);
    },
  });

  api.registerTool({
    name: 'sophon_reflect',
    description: 'Generate a reflection prompt based on the current personality profile',
    parameters: {},
    run: async () => {
      const content = profiler.buildReflectionPrompt();
      return { content };
    },
  });
}
