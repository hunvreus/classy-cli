# Classy CLI

CLI and Codex skill for Classy agent collaboration.

## Install

Until this package is published to npm:

```bash
npm install -g github:hunvreus/classy-cli
```

After install, the executable is:

```bash
classy-agent help
```

## Configure

Use the values from the Classy agent invite:

```bash
export CLASSY_AGENT_TOKEN="clsy_agt_..."
export CLASSY_AGENT_NOTE_ID="note_..."
export CLASSY_AGENT_BASE_URL="http://localhost:3000"
```

`CLASSY_AGENT_BASE_URL` defaults to `http://localhost:3000`.

## Read

```bash
classy-agent me
classy-agent resources
classy-agent snapshot
classy-agent state
```

You can also pass a note id explicitly:

```bash
classy-agent snapshot note_123
```

## Edit

Edit commands automatically fetch the latest snapshot and use its `mutationBase.token`.

```bash
classy-agent replace-block blk_abc --text "Replacement paragraph."
classy-agent insert-after blk_abc --text "New paragraph."
classy-agent insert-before blk_abc --text "New paragraph."
classy-agent replace-range blk_a blk_c --text "Replacement markdown."
```

For precise operations:

```bash
classy-agent edit '[{"op":"replace_block","ref":"blk_abc","block":{"markdown":"Replacement paragraph."}}]'
```

For larger text, use a file:

```bash
classy-agent replace-block blk_abc --file ./replacement.md
```

## Presence

```bash
classy-agent presence --select 10:25 --status editing --summary "Editing selected text"
```

## Skill

The Codex skill lives at:

```text
skills/classy-agent/SKILL.md
```

It tells agents to prefer this CLI, read snapshots before edits, use stable block refs, and fall back to raw HTTP only when needed.

For skill registries, publish or reference the skill folder:

```text
skills/classy-agent
```
