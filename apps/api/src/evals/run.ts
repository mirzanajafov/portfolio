import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { content } from '@portfolio/content';
import { KeywordAnswerEngine } from '../ask/keyword-engine.js';
import { buildKnowledge } from '../ask/knowledge.js';
import { adversarial } from './adversarial.js';
import { runEvals } from './evals.js';

const knowledge = buildKnowledge(content);
const report = await runEvals(
  new KeywordAnswerEngine(knowledge),
  knowledge,
  content.projects,
  adversarial,
);

const dir = join(import.meta.dirname, '..', '..', 'evals');
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `${report.engine}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`${report.engine}: ${report.hits}/${report.questions} questions cite an expected fact`);
for (const [project, entry] of Object.entries(report.byProject)) {
  console.log(`  ${project.padEnd(14)} ${entry.hits}/${entry.questions}`);
}
for (const result of report.results.filter((r) => !r.hit)) {
  console.log(`  miss  ${result.question}`);
  console.log(`        cited ${result.cited.join(', ') || 'nothing'}`);
}
console.log(`adversarial: ${report.adversarial.refused}/${report.adversarial.questions} refused`);
for (const result of report.adversarial.results.filter((r) => !r.refused)) {
  console.log(`  answered  ${result.question}`);
  console.log(`            cited ${result.cited.join(', ')}`);
}
