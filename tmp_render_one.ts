import { parse, render } from "./src/djot.ts";

const text = await Deno.readTextFile('content/posts/2026-03-31-sub-microsecond-inference-xgboost.dj');
const html = render(parse(text), {}).value;
const start = html.indexOf('<script type="module">');
const end = html.indexOf('</script>', start);
await Deno.writeTextFile('/Users/tommyers/code/tmyers273.github.io/tmp_script.js', html.slice(start + '<script type="module">'.length, end));
console.log('wrote', end - start);
