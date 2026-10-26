import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { slugSchema } from './schema.ts';

const projectTemplate = `name: ''
order: 0
hook: ''
summary: ''
visibility: public
links:
  live: ''
  repo: ''
stack: []
headline: ''
facts: []
health: ''
knowledge:
  - README.md
`;

const evalsTemplate = `- question: ''
  expects: []
`;

export async function scaffoldProject(root: string, slug: string): Promise<string> {
  if (!slugSchema.safeParse(slug).success) {
    throw new Error(`"${slug}" is not a slug: use lowercase letters, digits and single dashes`);
  }
  const dir = join(root, 'projects', slug);
  try {
    await mkdir(dir);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`projects/${slug} already exists`);
    }
    throw error;
  }
  await writeFile(join(dir, 'project.yaml'), projectTemplate, 'utf8');
  await writeFile(join(dir, 'evals.yaml'), evalsTemplate, 'utf8');
  return dir;
}
