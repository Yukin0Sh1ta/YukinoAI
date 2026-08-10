/**
 * @file db.ts
 * @description SQLite 数据库访问服务。
 *
 * 基于 tauri-plugin-sql，提供对话（conversation）与消息（message）
 * 两张表的建表、CRUD 操作，以及数据库行与领域对象之间的转换工具。
 * 使用懒加载的单例 Database 实例。
 */
import Database from '@tauri-apps/plugin-sql'
import type { Conversation, Message, ToolCall } from '~/types'

let db: Database | null = null

// ----------------------------------------------------------------------------
// 数据库初始化
// ----------------------------------------------------------------------------

/**
 * 初始化数据库（懒加载单例）。
 * 创建 conversations 与 messages 表及必要索引（若尚不存在）。
 * @returns 已初始化的 Database 实例
 */
export async function initDb(): Promise<Database> {
  if (db) return db
  db = await Database.load('sqlite:yukinoai.db')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      tool_call_id TEXT,
      tool_name TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `)

  // 按对话查询消息用的加速索引
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)
  `)

  return db
}

// ----------------------------------------------------------------------------
// 工具函数
// ----------------------------------------------------------------------------

/**
 * 生成 UUID。当 crypto.randomUUID 不可用时，回退为"时间戳 + 随机数"形式的 id。
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/**
 * 将数据库行转换为对话领域对象。
 * @param row 数据库行（snake_case 字段）
 * @returns 转换后的 Conversation 对象
 */
function rowToConversation(row: any): Conversation {
  return {
    id: row.id,
    characterId: row.character_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 将数据库行转换为消息领域对象。
 * @param row 数据库行（snake_case 字段，tool_calls 为 JSON 字符串）
 * @returns 转换后的 Message 对象
 */
function rowToMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
    toolCallId: row.tool_call_id || undefined,
    toolName: row.tool_name || undefined,
    createdAt: row.created_at,
  }
}

// ----------------------------------------------------------------------------
// 对话 CRUD
// ----------------------------------------------------------------------------

/**
 * 创建一条新对话并持久化到数据库。
 * @param characterId 所属角色 id
 * @param title 对话标题
 * @returns 创建后的 Conversation 对象
 */
export async function createConversation(characterId: string, title: string): Promise<Conversation> {
  const database = await initDb()
  const now = Date.now()
  const conversation: Conversation = {
    id: generateId(),
    characterId,
    title,
    createdAt: now,
    updatedAt: now,
  }

  await database.execute(
    `INSERT INTO conversations (id, character_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
    [conversation.id, conversation.characterId, conversation.title, conversation.createdAt, conversation.updatedAt],
  )

  return conversation
}

/**
 * 获取全部对话，按 updated_at 倒序排列。
 * @returns 对话列表
 */
export async function getConversations(): Promise<Conversation[]> {
  const database = await initDb()
  const result = await database.select<any[]>((
    `SELECT id, character_id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC`
  ))
  return result.map(rowToConversation)
}

/**
 * 删除指定对话及其全部消息。
 * @param id 对话 id
 */
export async function deleteConversation(id: string): Promise<void> {
  const database = await initDb()
  // SQLite 在未开启 PRAGMA foreign_keys = ON 时不总是强制外键级联，
  // 因此先手动删除该对话的消息。
  await database.execute(`DELETE FROM messages WHERE conversation_id = $1`, [id])
  await database.execute(`DELETE FROM conversations WHERE id = $1`, [id])
}

/**
 * 更新指定对话的标题。
 * @param id 对话 id
 * @param title 新标题
 */
export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const database = await initDb()
  await database.execute(
    `UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3`,
    [title, Date.now(), id],
  )
}

// ----------------------------------------------------------------------------
// 消息 CRUD
// ----------------------------------------------------------------------------

/**
 * 持久化一条消息，并刷新所属对话的 updated_at。
 * @param msg 待保存的消息
 */
export async function saveMessage(msg: Message): Promise<void> {
  const database = await initDb()
  const toolCallsJson = msg.toolCalls ? JSON.stringify(msg.toolCalls) : null

  await database.execute(
    `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, tool_name, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      msg.id,
      msg.conversationId,
      msg.role,
      msg.content,
      toolCallsJson,
      msg.toolCallId ?? null,
      msg.toolName ?? null,
      msg.createdAt,
    ],
  )

  // 保持对话的 updated_at 最新，使排序能反映近期活动
  await database.execute(
    `UPDATE conversations SET updated_at = $1 WHERE id = $2`,
    [Date.now(), msg.conversationId],
  )
}

/**
 * 获取指定对话下的全部消息，按 created_at 升序排列。
 * @param conversationId 对话 id
 * @returns 消息列表
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const database = await initDb()
  const result = await database.select<any[]>(
    `SELECT id, conversation_id, role, content, tool_calls, tool_call_id, tool_name, created_at
     FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId],
  )
  return result.map(rowToMessage)
}

/**
 * 更新指定消息的文本内容。
 * @param id 消息 id
 * @param content 新内容
 */
export async function updateMessageContent(id: string, content: string): Promise<void> {
  const database = await initDb()
  await database.execute(
    `UPDATE messages SET content = $1 WHERE id = $2`,
    [content, id],
  )
}

/**
 * 更新指定消息的工具调用列表（序列化为 JSON 后存储）。
 * @param id 消息 id
 * @param toolCalls 工具调用数组
 */
export async function updateMessageToolCalls(id: string, toolCalls: ToolCall[]): Promise<void> {
  const database = await initDb()
  await database.execute(
    `UPDATE messages SET tool_calls = $1 WHERE id = $2`,
    [JSON.stringify(toolCalls), id],
  )
}
