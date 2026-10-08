/**
 * 首屏体积度量脚本
 *
 * 统计 dist/index.html 中 <script src> 与所有 <link rel="modulepreload"> 指向的产物，
 * 累加 raw 与 gzip 体积 —— 这就是浏览器首屏必须下载的全部代码量。
 *
 * 为什么需要它：Vite 构建日志按文件名排序输出，直觉上"主 chunk 变小"不等于
 * "首屏变小"（例如把页面改成 lazy 后，总体积可能不变但首屏下降）。
 * 本脚本以 index.html 的实际引用为准，是判断拆包效果的唯一可靠口径。
 *
 * 用法：
 *   npm run build && npm run measure:size
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('未找到 dist/index.html，请先执行 npm run build');
  process.exit(1);
}

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

// 收集首屏入口与预加载的 chunk（去重）
const refs = new Set();
for (const m of html.matchAll(/<script[^>]+src="\/assets\/([^"]+)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+)"/g)) refs.add(m[1]);

const kb = (n) => (n / 1024).toFixed(1);
const rows = [];
let entryRaw = 0;
let entryGzip = 0;

for (const name of refs) {
  const file = path.join(distDir, 'assets', name);
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  entryRaw += buf.length;
  entryGzip += gz;
  rows.push({ file: name, raw: buf.length, gzip: gz });
}

rows.sort((a, b) => b.raw - a.raw);

console.log('首屏 chunk 明细（按 raw 降序）');
console.log('文件'.padEnd(40) + 'raw(KB)'.padStart(10) + 'gzip(KB)'.padStart(11));
for (const r of rows) {
  console.log(r.file.padEnd(40) + kb(r.raw).padStart(10) + kb(r.gzip).padStart(11));
}
console.log('-'.repeat(61));
console.log(`首屏合计：${rows.length} 个 chunk，raw ${kb(entryRaw)} KB，gzip ${kb(entryGzip)} KB`);

const assetsDir = path.join(distDir, 'assets');
const allFiles = fs.readdirSync(assetsDir)
  .map((f) => path.join(assetsDir, f))
  .filter((f) => fs.statSync(f).isFile());

let allRaw = 0;
let allGzip = 0;
let largest = { file: '', raw: 0 };
for (const f of allFiles) {
  const buf = fs.readFileSync(f);
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  allRaw += buf.length;
  allGzip += gz;
  if (buf.length > largest.raw) {
    largest = { file: path.basename(f), raw: buf.length };
  }
}

console.log(`全量产物：${allFiles.length} 个文件，raw ${kb(allRaw)} KB，gzip ${kb(allGzip)} KB`);
console.log(`首屏占比：raw ${((entryRaw / allRaw) * 100).toFixed(1)}%，gzip ${((entryGzip / allGzip) * 100).toFixed(1)}%`);
console.log(`最大单文件：${largest.file} ${kb(largest.raw)} KB`);
console.log('\n参考阈值：单文件 gzip > 200 KB 或首屏 gzip > 400 KB 时，应继续做代码分割。');