import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentError, loadContent } from './load.ts';
import { writeGenerated } from './generate.ts';
import { scaffoldProject } from './scaffold.ts';

const srcDir = dirname(fileURLToPath(import.meta.url));
const root = join(srcDir, '..');

function printIssues(error: ContentError): void {
  console.error(`content has ${error.issues.length} problem(s):`);
  for (const issue of error.issues) {
    console.error(`  ${issue.file} ${issue.path}: ${issue.message}`);
  }
}

async function validate(write: boolean): Promise<void> {
  try {
    const content = await loadContent(root);
    if (write) {
      const file = await writeGenerated(content, srcDir);
      console.log(`content is valid, wrote ${relative(root, file)}`);
    } else {
      console.log(`content is valid: ${content.projects.length} project(s)`);
    }
  } catch (error) {
    if (error instanceof ContentError) {
      printIssues(error);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

async function newProject(slug: string | undefined): Promise<void> {
  if (!slug) {
    console.error('usage: cli.ts new <slug>');
    process.exitCode = 2;
    return;
  }
  const dir = await scaffoldProject(root, slug);
  console.log(`created ${relative(root, dir)}; fill in what the checks below ask for:`);
  await validate(false);
}

const [command, argument] = process.argv.slice(2);

if (command === 'validate') {
  await validate(false);
} else if (command === 'generate') {
  await validate(true);
} else if (command === 'new') {
  await newProject(argument);
} else {
  console.error('usage: cli.ts <validate|generate|new <slug>>');
  process.exitCode = 2;
}
