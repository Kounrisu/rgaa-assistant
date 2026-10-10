// Builds a copy of axe-core that never calls Function() / eval, so it runs on pages with a strict
// Content-Security-Policy (Firefox applies the page's CSP to content scripts).
// axe-core is MPL-2.0: this file is the (small) set of modifications we make to it. See THIRD-PARTY.md.
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const replacements = [
  // doT templates (messages with {{=...}}): not needed here, we do not use the message texts
  ["new Function('def', 'def[\\'' + code + '\\']=' + value)(def);", 'void 0;'],
  ["var v = new Function('def', 'return ' + code)(def);", 'var v = void 0;'],
  ['return new Function(c4.varname, str);', "return function () {\n              return '';\n            };"],
  // functions given as source text (custom rules / locale messages): we only use the built-in ones
  ["return new Function('return ' + spec + ';')();", "throw new Error('axe: functions given as text are not supported here');"],
  ["metadata.messages[prop] = new Function('return ' + metadata.messages[prop] + ';')();", 'metadata.messages[prop] = metadata.messages[prop];'],
  // function with the same number of arguments (used by memoization)
  [
    "return new Function('fn', 'return function (' + args.join(', ') + ') { return fn.apply(this, arguments); };');",
    "var arity = args.length;\n            return function (fn) {\n              var wrapped = function () {\n                return fn.apply(this, arguments);\n              };\n              try {\n                Object.defineProperty(wrapped, 'length', { value: arity });\n              } catch (e) {}\n              return wrapped;\n            };",
  ],
  // global object lookups that fall back to Function('return this')()
  ["Function('return this')().require('vertx')", "globalThis.require('vertx')"],
  ["local = Function('return this')();", 'local = globalThis;'],
  ["}() || Function('return this')();", '}() || globalThis;'],
]

export function patchedAxe(source = readFileSync('node_modules/axe-core/axe.js', 'utf8')) {
  let code = source
  for (const [from, to] of replacements) {
    const parts = code.split(from)
    if (parts.length !== 2) throw new Error(`patch-axe: expected exactly one place to patch, found ${parts.length - 1} for: ${from.slice(0, 60)}`)
    code = parts.join(to)
  }
  if (/new Function\(|[^.\w$]Function\(|[^.\w$]eval\(/.test(code)) throw new Error('patch-axe: a Function()/eval call is still in the code (axe-core was updated?)')
  return `/* axe-core, MPL-2.0, patched by scripts/patch-axe.mjs to avoid Function()/eval */\n${transformSync(code, { minify: true, legalComments: 'none' }).code}`
}
