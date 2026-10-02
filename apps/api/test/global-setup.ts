import { execSync } from 'node:child_process';
import { config } from 'dotenv';

export default function setup(): void {
  const { parsed } = config({ path: '.env.test', quiet: true, processEnv: {} });
  execSync('npx prisma migrate deploy', { env: { ...process.env, ...parsed }, stdio: 'ignore' });
}
