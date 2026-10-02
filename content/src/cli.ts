import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentError, loadContent } from './load.ts';
import { writeGenerated } from './generate.ts';

const srcDir = dirname(fileURLToPath(import.meta.url));
const root = join(srcDir, '..');

async function main(command: string | undefined): Promise<void> {
  if (command !== 'validate' && command !== 'generate') {
    console.error('usage: cli.ts <validate|generate>');
    process.exitCode = 2;
    return;
  }
  try {
    const content = await loadContent(root);
    if (command === 'generate') {
      const file = await writeGenerated(content, srcDir);
      console.log(`content is valid, wrote ${relative(root, file)}`);
    } else {
      console.log('content is valid');
    }
  } catch (error) {
    if (error instanceof ContentError) {
      console.error(`content has ${error.issues.length} problem(s):`);
      for (const issue of error.issues) {
        console.error(`  ${issue.file} ${issue.path}: ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

await main(process.argv[2]);
