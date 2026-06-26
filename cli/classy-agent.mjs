#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_BASE_URL = 'http://localhost:3000'
const DEFAULT_INSTANCE_ID = `classy-agent-${process.pid}`

export function usage() {
  return `Classy agent CLI

Usage:
  classy-agent me
  classy-agent resources
  classy-agent state [noteId]
  classy-agent snapshot [noteId]
  classy-agent edit [noteId] '<operations-json>'
  classy-agent replace-block [noteId] <ref> (--text <markdown> | --file <path>)
  classy-agent insert-before [noteId] <ref> (--text <markdown> | --file <path>)
  classy-agent insert-after [noteId] <ref> (--text <markdown> | --file <path>)
  classy-agent replace-range [noteId] <fromRef> <toRef> (--text <markdown> | --file <path>)
  classy-agent find-replace-doc [noteId] <oldText> <newText> [--all]
  classy-agent find-replace-block [noteId] <ref> <oldText> <newText> [--all]
  classy-agent presence [noteId] --select <anchor>:<head> [--status <status>] [--summary <text>]

Environment:
  CLASSY_AGENT_TOKEN       Required bearer token.
  CLASSY_AGENT_NOTE_ID     Default note id for note commands.
  CLASSY_AGENT_BASE_URL    Defaults to ${DEFAULT_BASE_URL}.
  CLASSY_AGENT_INSTANCE_ID Defaults to ${DEFAULT_INSTANCE_ID}.

Examples:
  CLASSY_AGENT_TOKEN=clsy_agt_... CLASSY_AGENT_NOTE_ID=note_123 classy-agent snapshot
  classy-agent replace-block blk_abc --text "Replacement paragraph."
  classy-agent edit note_123 '[{"op":"insert_after","ref":"blk_abc","blocks":[{"markdown":"New paragraph."}]}]'
`
}

export function parseArgs(argv, env = process.env) {
  const [command = 'help', ...rest] = argv
  const { positionals, flags } = parseFlags(rest)
  const config = {
    baseUrl: normalizeBaseUrl(flags['base-url'] ?? env.CLASSY_AGENT_BASE_URL ?? DEFAULT_BASE_URL),
    instanceId: flags['instance-id'] ?? env.CLASSY_AGENT_INSTANCE_ID ?? DEFAULT_INSTANCE_ID,
    noteId: flags.note ?? env.CLASSY_AGENT_NOTE_ID ?? null,
    token: flags.token ?? env.CLASSY_AGENT_TOKEN ?? null,
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    return { command: 'help', config }
  }
  if (command === 'me' || command === 'resources') {
    return { command, config }
  }
  if (command === 'state' || command === 'snapshot') {
    const noteId = readNoteId(command, positionals, config.noteId, 0)
    return { command, config: { ...config, noteId } }
  }
  if (command === 'edit') {
    const { noteId, args } = splitOptionalNoteId(command, positionals, config.noteId, 1)
    return {
      command,
      config: { ...config, noteId },
      operations: parseJsonArg(args[0], 'operations-json'),
    }
  }
  if (command === 'replace-block') {
    const { noteId, args } = splitOptionalNoteId(command, positionals, config.noteId, 1)
    return {
      command: 'edit',
      config: { ...config, noteId },
      operations: [{ op: 'replace_block', ref: args[0], block: { markdown: readMarkdown(flags) } }],
    }
  }
  if (command === 'insert-before' || command === 'insert-after') {
    const { noteId, args } = splitOptionalNoteId(command, positionals, config.noteId, 1)
    return {
      command: 'edit',
      config: { ...config, noteId },
      operations: [{
        op: command === 'insert-before' ? 'insert_before' : 'insert_after',
        ref: args[0],
        blocks: markdownBlocks(readMarkdown(flags)),
      }],
    }
  }
  if (command === 'replace-range') {
    const { noteId, args } = splitOptionalNoteId(command, positionals, config.noteId, 2)
    return {
      command: 'edit',
      config: { ...config, noteId },
      operations: [{ op: 'replace_range', fromRef: args[0], toRef: args[1], blocks: markdownBlocks(readMarkdown(flags)) }],
    }
  }
  if (command === 'find-replace-doc') {
    const { noteId, args } = splitOptionalNoteId(command, positionals, config.noteId, 2)
    return {
      command: 'edit',
      config: { ...config, noteId },
      operations: [{
        op: 'find_replace_in_doc',
        oldText: args[0],
        newText: args[1],
        occurrence: flags.all ? 'all' : 'first',
      }],
    }
  }
  if (command === 'find-replace-block') {
    const { noteId, args } = splitOptionalNoteId(command, positionals, config.noteId, 3)
    return {
      command: 'edit',
      config: { ...config, noteId },
      operations: [{
        op: 'find_replace_in_block',
        ref: args[0],
        oldText: args[1],
        newText: args[2],
        occurrence: flags.all ? 'all' : 'first',
      }],
    }
  }
  if (command === 'presence') {
    const { noteId } = splitOptionalNoteId(command, positionals, config.noteId, 0)
    return {
      command,
      config: { ...config, noteId },
      body: {
        selection: flags.select ? parseSelection(flags.select) : null,
        status: flags.status ?? 'editing',
        summary: flags.summary ?? null,
      },
    }
  }

  throw new CliError(`Unknown command: ${command}`)
}

export async function run(argv, env = process.env) {
  const parsed = parseArgs(argv, env)
  if (parsed.command === 'help') {
    return { status: 0, output: usage() }
  }
  requireToken(parsed.config)

  if (parsed.command === 'me') {
    return jsonResult(await request(parsed.config, '/api/agent/me'))
  }
  if (parsed.command === 'resources') {
    return jsonResult(await request(parsed.config, '/api/agent/resources'))
  }
  if (parsed.command === 'state') {
    return jsonResult(await request(parsed.config, `/api/agent/notes/${encodeURIComponent(parsed.config.noteId)}/state`))
  }
  if (parsed.command === 'snapshot') {
    return jsonResult(await snapshot(parsed.config))
  }
  if (parsed.command === 'edit') {
    const current = await snapshot(parsed.config)
    const result = await request(parsed.config, `/api/agent/notes/${encodeURIComponent(parsed.config.noteId)}/edits`, {
      baseToken: current.mutationBase.token,
      operations: parsed.operations,
    })
    return jsonResult(result)
  }
  if (parsed.command === 'presence') {
    const result = await request(parsed.config, `/api/agent/notes/${encodeURIComponent(parsed.config.noteId)}/presence`, parsed.body)
    return jsonResult(result)
  }

  throw new CliError(`Unhandled command: ${parsed.command}`)
}

export class CliError extends Error {
  constructor(message, status = 1) {
    super(message)
    this.name = 'CliError'
    this.status = status
  }
}

function parseFlags(args) {
  const flags = {}
  const positionals = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    const withoutPrefix = arg.slice(2)
    const equalsIndex = withoutPrefix.indexOf('=')
    if (equalsIndex !== -1) {
      flags[withoutPrefix.slice(0, equalsIndex)] = withoutPrefix.slice(equalsIndex + 1)
      continue
    }
    const next = args[index + 1]
    if (!next || next.startsWith('--')) {
      flags[withoutPrefix] = true
      continue
    }
    flags[withoutPrefix] = next
    index += 1
  }
  return { flags, positionals }
}

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/, '')
}

function readNoteId(command, positionals, fallback, requiredPositionals) {
  const { noteId } = splitOptionalNoteId(command, positionals, fallback, requiredPositionals)
  return noteId
}

function splitOptionalNoteId(command, positionals, fallback, requiredPositionals) {
  if (positionals.length === requiredPositionals) {
    if (!fallback) {
      throw new CliError(`${command} requires a note id or CLASSY_AGENT_NOTE_ID`)
    }
    return { noteId: fallback, args: positionals }
  }
  if (positionals.length === requiredPositionals + 1) {
    return { noteId: positionals[0], args: positionals.slice(1) }
  }
  throw new CliError(`${command} expected ${requiredPositionals} argument(s) plus optional note id`)
}

function parseJsonArg(value, label) {
  if (!value) {
    throw new CliError(`Missing ${label}`)
  }
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      throw new CliError(`${label} must be a JSON array`)
    }
    return parsed
  } catch (error) {
    if (error instanceof CliError) {
      throw error
    }
    throw new CliError(`Invalid ${label}: ${error.message}`)
  }
}

function readMarkdown(flags) {
  if (flags.text && flags.file) {
    throw new CliError('Use --text or --file, not both')
  }
  if (typeof flags.text === 'string') {
    return flags.text
  }
  if (typeof flags.file === 'string') {
    return readFileSync(flags.file, 'utf8')
  }
  throw new CliError('Missing --text or --file')
}

function markdownBlocks(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return [{ markdown: '' }]
  }
  return normalized.split(/\n{2,}/).map((block) => ({ markdown: block.trim() }))
}

function parseSelection(value) {
  const match = /^(\d+):(\d+)$/.exec(String(value))
  if (!match) {
    throw new CliError('--select must use anchor:head')
  }
  return { anchor: Number(match[1]), head: Number(match[2]) }
}

function requireToken(config) {
  if (!config.token) {
    throw new CliError('Missing CLASSY_AGENT_TOKEN or --token')
  }
}

async function snapshot(config) {
  return request(config, `/api/agent/notes/${encodeURIComponent(config.noteId)}/snapshot`)
}

async function request(config, path, body) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'X-Agent-Instance-Id': config.instanceId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  const payload = text ? parseJsonResponse(text) : null
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? response.statusText
    throw new CliError(`HTTP ${response.status}: ${message}`)
  }
  return payload
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function jsonResult(value) {
  return { status: 0, output: `${JSON.stringify(value, null, 2)}\n` }
}

const isMain = process.argv[1] && basename(fileURLToPath(import.meta.url)) === basename(process.argv[1])
if (isMain) {
  run(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(result.output)
      process.exitCode = result.status
    })
    .catch((error) => {
      const status = error instanceof CliError ? error.status : 1
      process.stderr.write(`${error.message}\n`)
      process.exitCode = status
    })
}
