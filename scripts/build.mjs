import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../site/', import.meta.url), output, { recursive: true });
await writeFile(new URL('.nojekyll', output), '');
console.log('Built static site in dist/');
