// Dependency-free deployment gate, also run by GitHub Actions on Linux.
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, dirname, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function verifySite(folder) {
  const root = resolve(folder), files = [], errors = [], links = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) { errors.push(`Symlink not allowed: ${relative(root, path)}`); continue; }
      if (entry.isDirectory()) await walk(path);
      else files.push(relative(root, path).split(sep).join('/'));
    }
  }
  await walk(root);
  const exact = new Set(files), lowercase = new Set();
  let totalBytes = 0, largest = { path: '', bytes: 0 };
  function reference(owner, value) {
    if (!value || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(value)) return;
    if (value.includes('${')) return;
    const clean = decodeURIComponent(value.split(/[?#]/)[0]);
    if (!clean) return;
    if (clean.startsWith('/')) { errors.push(`Root-relative resource: ${owner} -> ${clean}`); return; }
    const target = relative(root, resolve(root, dirname(owner), clean)).split(sep).join('/');
    if (!exact.has(target)) errors.push(`Missing/case-mismatched resource: ${owner} -> ${target}`);
    else links.push({ from: owner, to: target });
  }
  for (const file of files) {
    if (lowercase.has(file.toLowerCase())) errors.push(`Case collision: ${file}`);
    lowercase.add(file.toLowerCase());
    if (/(?:^|\/)(?:\.git|\.env|\.openai|node_modules|qa|tmp|docs)(?:[/.]|$)/i.test(file)) errors.push(`Internal file: ${file}`);
    const size = (await stat(resolve(root, file))).size;
    totalBytes += size;
    if (size > largest.bytes) largest = { path: file, bytes: size };
    if (size >= 100 * 1024 ** 2) errors.push(`File exceeds regular Git limit: ${file}`);
    if (!['.html', '.js', '.css', '.svg', '.json'].includes(extname(file))) continue;
    const source = (await readFile(resolve(root, file), 'utf8')).replace(/^.*@three_import.*$/gm, '');
    if (/[A-Za-z]:[\\/](?:Users|download|秋招文件|PSAutoRecover)/i.test(source)) errors.push(`Local path: ${file}`);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_)[A-Za-z0-9_]{25,}|sk-[A-Za-z0-9]{32,}/.test(source)) errors.push(`Possible secret: ${file}`);
    if (extname(file) === '.js') {
      try { execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'pipe' }); }
      catch { errors.push(`JavaScript syntax error: ${file}`); }
      for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)) if(match[1].startsWith('.')||match[1].startsWith('/')) reference(file, match[1]);
      for (const match of source.matchAll(/new URL\(['"]([^'"]+)['"],\s*import\.meta\.url\)/g)) {
        if (!match[1].endsWith('/')) reference(file, match[1]);
        else if (!files.some(name => name.startsWith(relative(root, resolve(root, dirname(file), match[1])).split(sep).join('/') + '/'))) errors.push(`Missing media directory: ${file}`);
      }
    }
    if (extname(file) === '.html') {
      for (const match of source.matchAll(/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/g)) reference(file, match[1]);
      if (!/<html[^>]*\blang=/i.test(source)) errors.push(`Missing document language: ${file}`);
      if (!/name=["']viewport["']/i.test(source)) errors.push(`Missing viewport: ${file}`);
    }
    if (extname(file) === '.css') for (const match of source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) reference(file, match[1]);
  }
  if (totalBytes >= 1024 ** 3) errors.push('Site exceeds GitHub Pages size limit');
  for (const required of ['index.html', 'tree-study.html', 'tree.html', 'layers.html', 'future.html', '404.html', '.nojekyll']) if (!exact.has(required)) errors.push(`Missing entry: ${required}`);
  for (let i = 1; i <= 4; i++) for (const suffix of ['.webp', '-thumb.webp', '-full.jpg']) {
    const file = `media/competition/board-0${i}${suffix}`;
    if (!exact.has(file)) errors.push(`Missing board: ${file}`);
  }
  for (const name of ['dudu-little-house', 'rainy-night-decision', 'little-cat-healing-life']) for (const ext of ['.mp4', '.webp']) {
    if (!exact.has(`media/zeemo/${name}${ext}`)) errors.push(`Missing video asset: ${name}${ext}`);
  }
  const result = { passed: errors.length === 0, files: files.length, checkedReferences: links.length, totalBytes, largest, errors };
  if (errors.length) throw new Error(JSON.stringify(result, null, 2));
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifySite(process.argv[2] || 'site'), null, 2));
}
