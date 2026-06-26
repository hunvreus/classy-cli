import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { test } from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const cliPath = new URL('../cli/classy-agent.mjs', import.meta.url)

test('prints command help', async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath.pathname, 'help'])

  assert.match(stdout, /Classy agent CLI/)
  assert.match(stdout, /replace-block/)
  assert.match(stdout, /CLASSY_AGENT_TOKEN/)
})

test('fails before network requests when the token is missing', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath.pathname, 'me'], {
      env: { ...process.env, CLASSY_AGENT_TOKEN: '' },
    }),
    { stderr: /Missing CLASSY_AGENT_TOKEN or --token/ },
  )
})

test('validates edit operation JSON locally', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath.pathname, 'edit', 'note_1', 'not-json'], {
      env: { ...process.env, CLASSY_AGENT_TOKEN: 'clsy_agt_test' },
    }),
    { stderr: /Invalid operations-json/ },
  )
})
