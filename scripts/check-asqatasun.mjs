// Checks the tests ported from Asqatasun (src/lib/asqatasun-rules.ts) against Asqatasun's own HTML fixtures.
//
//   node scripts/check-asqatasun.mjs [--dir <folder>] [--refresh] [--rule 080101] [--list] [--strict]
//
// Asqatasun ships, for each RGAA 4 test, HTML pages whose file name says the expected outcome
// (Rgaa40.Test.8.1.1-1Passed-01.html, -2Failed-, -3NMI- = "need more info", -4NA- = not applicable). This script
//   1. downloads them on demand (GitHub, about 700 small files) into a temporary folder, never into the repository;
//   2. bundles the engine with esbuild and runs it in jsdom on every fixture of a ported test;
//   3. prints, per test, how many fixtures agree with the expected outcome, and the ones that do not.
// The fixtures belong to Asqatasun (AGPL-3.0, see NOTICE.md); they are not part of this repository.
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const fixturesDir = resolve(option('--dir', join(tmpdir(), 'asqatasun-fixtures')))
const onlyRule = option('--rule', null)

// Pinned revision of Asqatasun: the fixtures never change under our feet. Move it deliberately, then re-run this check.
const REVISION = 'af9064357e881786cc7cc72e782662908bd91c5b'
const API = `https://api.github.com/repos/Asqatasun/Asqatasun/git/trees/${REVISION}?recursive=1`
const RAW = `https://raw.githubusercontent.com/Asqatasun/Asqatasun/${REVISION}/`
const FIXTURE_PATH = /^rules\/rules-rgaa4\.0\/src\/test\/resources\/testcases\/rgaa40\/(Rgaa40Rule\d{4}(?:\d{2})?)\/([^/]+)\.html$/
const TEST_CLASS_PATH = /^rules\/rules-rgaa4\.0\/src\/test\/java\/org\/asqatasun\/rules\/rgaa40\/(Rgaa40Rule\d{6})Test\.java$/

async function download() {
  console.log(`Downloading Asqatasun's fixtures into ${fixturesDir} …`)
  const tree = await (await fetch(API, { headers: { 'User-Agent': 'rgaa-assistant' } })).json()
  if (!tree.tree) throw new Error(`GitHub did not answer with a file tree (${tree.message ?? 'unknown error'})`)
  const paths = tree.tree.map((n) => n.path).filter((p) => FIXTURE_PATH.test(p) && !p.endsWith('.dist.html'))
  const classes = tree.tree.map((n) => n.path).filter((p) => TEST_CLASS_PATH.test(p))
  let done = 0
  const queue = [...paths, ...classes]
  const worker = async () => {
    for (let path = queue.pop(); path; path = queue.pop()) {
      const res = await fetch(RAW + path)
      if (!res.ok) throw new Error(`${path}: ${res.status}`)
      const isClass = TEST_CLASS_PATH.test(path)
      const rule = (isClass ? TEST_CLASS_PATH : FIXTURE_PATH).exec(path)[1]
      mkdirSync(join(fixturesDir, rule), { recursive: true })
      writeFileSync(join(fixturesDir, rule, isClass ? 'Test.java' : path.split('/').pop()), await res.text())
      done++
    }
  }
  await Promise.all(Array.from({ length: 12 }, worker))
  writeFileSync(join(fixturesDir, '.complete'), String(done))
  console.log(`${done} files downloaded (fixtures and the Java test classes that say which ones are asserted).\n`)
}

if (flag('--refresh') || !existsSync(join(fixturesDir, '.complete'))) await download()

// the engine, bundled for node (it only needs a DOM Document)
const outDir = join(tmpdir(), 'rgaa-assistant-asq')
mkdirSync(outDir, { recursive: true })
const bundle = join(outDir, 'engine.mjs')
await build({ entryPoints: [join(root, 'src/lib/asqatasun-rules.ts')], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error' })
const engine = await import(`${pathToFileURL(bundle).href}?${Date.now()}`)

const EXPECTED = { Passed: 'passed', Failed: 'failed', NMI: 'nmi', NA: 'na' }
const NAMES = { passed: 'passed', failed: 'failed', nmi: 'need more info', na: 'not applicable' }
/**
 * What Asqatasun's own Java test asserts: the fixtures it processes (the others are commented out or empty) and, for
 * failed / need-more-info pages, how many remarks it expects (`checkResultIsFailed(result, elements, remarks)`).
 */
function activeFixtures(dir) {
  const file = join(fixturesDir, dir, 'Test.java')
  if (!existsSync(file)) return null
  const code = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  const out = new Map()
  const calls = [...code.matchAll(/processPageTest\("([^"]+)"\)/g)]
  calls.forEach((m, i) => {
    const from = Math.max(0, m.index - 60)
    const to = i + 1 < calls.length ? calls[i + 1].index - 60 : code.length
    const around = code.slice(from, Math.max(to, m.index + 200))
    const count = /checkResultIs(?:Failed|PreQualified)\(\s*[^,()]*(?:\([^)]*\))?\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(around)
    out.set(m[1], count ? Number(count[2]) : null)
  })
  return out
}

const rows = new Map() // test id -> { agree, total, mismatches: [], counts: [agree, total] }
const errors = new Set()
let placeholders = 0
let inactive = 0
const activeCache = {}
let notPorted = 0

for (const dir of readdirSync(fixturesDir).filter((d) => /^Rgaa40Rule\d{6}$/.test(d)).sort()) {
  if (onlyRule && dir !== `Rgaa40Rule${onlyRule}`) continue
  for (const file of readdirSync(join(fixturesDir, dir)).filter((f) => f.endsWith('.html')).sort()) {
    const m = /^Rgaa40\.Test\.([\d.]+)-(\d)(Passed|Failed|NMI|NA)-(\d+)\.html$/.exec(file)
    if (!m) continue
    const [, test, , kind, n] = m
    const active = (activeCache[dir] ??= activeFixtures(dir))
    if (active && !active.has(file.replace(/\.html$/, ''))) {
      inactive++ // Asqatasun's own test does not assert this page (commented out): no expected outcome to compare with
      continue
    }
    const html = readFileSync(join(fixturesDir, dir, file), 'utf8')
    let page = html
    if (html.includes('<!-- #testcase -->')) {
      // Asqatasun's own test harness replaces this tag with the grouped page of the criterion (Rgaa40Rule0104/nmi.html…)
      const grouped = join(fixturesDir, dir.slice(0, -2), `${{ Passed: 'passed', Failed: 'failed', NMI: 'nmi', NA: 'na' }[kind]}.html`)
      if (!existsSync(grouped)) {
        placeholders++
        continue
      }
      page = html.replace('<!-- #testcase -->', readFileSync(grouped, 'utf8'))
    }
    const { window } = new JSDOM(page)
    let got
    let elements = null
    try {
      const evaluation = engine.evaluateAsqRules(window.document, undefined, (t, e) => errors.add(`${t}: ${e?.message ?? e}`))
      got = evaluation.tests[test]
      elements = evaluation.findings.filter((f) => f.asq.test === test && f.asq.status !== 'na' && f.asq.status !== 'pass').reduce((sum, f) => sum + f.count, 0)
    } catch (e) {
      got = `error: ${e.message}`
    }
    window.close()
    if (got === undefined) {
      notPorted++
      continue
    }
    const row = rows.get(test) ?? { agree: 0, total: 0, mismatches: [], counts: [0, 0] }
    row.total++
    if (got === EXPECTED[kind]) {
      row.agree++
      const expectedRemarks = active?.get(file.replace(/\.html$/, ''))
      if (typeof expectedRemarks === 'number' && (kind === 'Failed' || kind === 'NMI')) {
        row.counts[1]++
        if (expectedRemarks === elements) row.counts[0]++
        else row.countNotes = [...(row.countNotes ?? []), `${kind}-${n}: ${elements} vs ${expectedRemarks}`]
      }
    } else row.mismatches.push(`${kind}-${n}: got ${NAMES[got] ?? got}`)
    rows.set(test, row)
  }
}

const byTest = (a, b) => a[0].split('.').map(Number).reduce((d, x, i) => d || x - b[0].split('.').map(Number)[i], 0)
const sorted = [...rows.entries()].sort(byTest)
console.log('Test      agree/total   mismatches')
let agree = 0
let total = 0
let countAgree = 0
let countTotal = 0
const families = new Map()
for (const [test, row] of sorted) {
  agree += row.agree
  total += row.total
  countAgree += row.counts[0]
  countTotal += row.counts[1]
  const fam = families.get(test.split('.')[0]) ?? { agree: 0, total: 0 }
  fam.agree += row.agree
  fam.total += row.total
  families.set(test.split('.')[0], fam)
  const flagged = row.agree === row.total ? 'ok' : row.mismatches.join('; ')
  if (flag('--list') || row.agree !== row.total) console.log(`${test.padEnd(9)} ${`${row.agree}/${row.total}`.padEnd(13)} ${flagged}`)
  if (flag('--counts') && row.countNotes) console.log(`${test.padEnd(9)} element counts differ: ${row.countNotes.join('; ')}`)
}
console.log('\nBy theme:')
for (const [theme, f] of [...families.entries()].sort((a, b) => a[0] - b[0])) console.log(`  theme ${theme.padStart(2)}: ${f.agree}/${f.total}`)
console.log(`\nAgreement: ${agree}/${total} fixtures (${total ? ((100 * agree) / total).toFixed(1) : 0}%) over ${rows.size} ported tests.`)
console.log(`Number of elements reported (where Asqatasun's test states it, for agreeing failed / need-more-info pages): ${countAgree}/${countTotal} (--counts lists the differences; our notes group elements differently on some tests).`)
console.log(`Left out: ${inactive} fixtures that Asqatasun's own test does not assert (commented out or empty), ${placeholders} placeholders whose grouped page is missing, ${notPorted} that belong to tests not ported.`)
// every wording of the ported tests must have a French entry (scripts/check-i18n.mjs only sees literal t('…') calls)
const rulesSource = readFileSync(join(root, 'src/lib/asqatasun-rules.ts'), 'utf8')
const frenchSource = readFileSync(join(root, 'src/lib/i18n-fr-lib.ts'), 'utf8')
const wordings = [...new Set([...rulesSource.matchAll(/(['`])(RGAA[^'`\n]*?)\1/g)].map((m) => m[2]))]
const untranslated = wordings.filter((w) => !frenchSource.includes(`'${w.replaceAll("'", "\\'")}':`))
console.log(untranslated.length ? `\nNo French translation for:\n  ${untranslated.join('\n  ')}` : `\nFrench: the ${wordings.length} wordings of the ported tests all have a translation.`)
if (errors.size) console.log(`\nTests that raised an error (selector not understood by jsdom?):\n  ${[...errors].join('\n  ')}`)
if (flag('--strict') && (agree !== total || errors.size || untranslated.length)) process.exit(1)
