# Classy agent

Use this skill when you are invited to collaborate in Classy with an agent bearer token, or when the user asks you to read, edit, comment on, or signal presence in a Classy note as an agent.

## Rules

- Treat the bearer token as a secret. Do not print it back unless the user explicitly asks.
- Prefer the `classy-agent` CLI when it is available.
- Use raw HTTP endpoints only when the CLI is unavailable.
- Always read `snapshot` before direct edits.
- Use stable `blocks[].ref` values for edits. Do not use ordinal refs for writes.
- Do not use full-document rewrites unless the user explicitly asks for a rewrite.
- If an edit returns `stale_base` or `stale_block_ref`, read `snapshot` again and retry against the latest text.
- Make the smallest precise edit that satisfies the request.

## CLI setup

Install from GitHub:

```bash
npm install -g github:hunvreus/classy-cli
```

Set the values from the Classy invite:

```bash
export CLASSY_AGENT_TOKEN="clsy_agt_..."
export CLASSY_AGENT_NOTE_ID="note_..."
export CLASSY_AGENT_BASE_URL="http://localhost:3000"
```

`CLASSY_AGENT_BASE_URL` is optional for local Classy because the CLI defaults to `http://localhost:3000`.

## CLI workflow

Read the note:

```bash
classy-agent snapshot
```

Replace one block:

```bash
classy-agent replace-block <block-ref> --text "Replacement paragraph."
```

Insert content:

```bash
classy-agent insert-after <block-ref> --text "New paragraph."
classy-agent insert-before <block-ref> --text "New paragraph."
```

Replace a range:

```bash
classy-agent replace-range <from-ref> <to-ref> --text "Replacement markdown."
```

Use exact edit JSON when needed:

```bash
classy-agent edit '[{"op":"replace_block","ref":"blk_...","block":{"markdown":"Replacement paragraph."}}]'
```

Signal presence:

```bash
classy-agent presence --select 10:25 --status editing --summary "Editing selected text"
```

## Raw HTTP fallback

Send `Authorization: Bearer <token>` on every request.

Start with:

```http
GET /api/agent/me
GET /api/agent/resources
GET /api/agent/notes/{noteId}/snapshot
```

Apply edits:

```http
POST /api/agent/notes/{noteId}/edits
```

```json
{
  "baseToken": "mt1:...",
  "operations": [
    {
      "op": "replace_block",
      "ref": "blk_...",
      "block": { "markdown": "Replacement paragraph." }
    }
  ]
}
```

Presence:

```http
POST /api/agent/notes/{noteId}/presence
```

```json
{
  "status": "editing",
  "selection": { "anchor": 10, "head": 25 },
  "summary": "Editing selected text"
}
```
