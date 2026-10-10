import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(__dirname, '..', 'src', 'panel')
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'))

/** The modules a file imports at run time (`import type` is erased, so it cannot make a cycle). */
const importsOf = (file: string): string[] =>
  [...readFileSync(join(DIR, file), 'utf8').matchAll(/^import (?!type )[^;]*? from '\.\/([\w-]+)'/gm)].map((m) => `${m[1]}.ts`)

describe('the layout of src/panel', () => {
  it('has no import cycle: upward calls go through actions.ts', () => {
    const graph = new Map(files.map((f) => [f, importsOf(f)]))
    const cycles: string[] = []
    const done = new Set<string>()
    const walk = (node: string, path: string[]): void => {
      if (path.includes(node)) return void cycles.push([...path.slice(path.indexOf(node)), node].join(' -> '))
      if (done.has(node)) return
      for (const next of graph.get(node) ?? []) walk(next, [...path, node])
      done.add(node)
    }
    for (const f of files) walk(f, [])
    expect(cycles).toEqual([])
  })

  it('keeps panel.ts a thin entry point', () => {
    const lines = readFileSync(join(DIR, 'panel.ts'), 'utf8').split('\n').length
    expect(lines).toBeLessThan(200)
  })

  it('takes the registry type from panel.ts without a run-time import', () => {
    // actions.ts only imports the registry's TYPE from panel.ts: a runtime import would be a cycle
    expect(readFileSync(join(DIR, 'actions.ts'), 'utf8')).toMatch(/^import type \{ Registry \} from '\.\/panel'/m)
  })
})
