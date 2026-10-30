import 'dotenv/config';
import 'reflect-metadata';
import { runCli } from './cli/run.js';

process.exitCode = await runCli(process.argv.slice(2));
