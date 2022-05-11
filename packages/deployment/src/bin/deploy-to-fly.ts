import * as dotenv from 'dotenv';
import { execaCommandSync } from 'execa';
import { chProjectDir } from 'lion-system';
import * as fs from 'node:fs';

chProjectDir(import.meta.url, { monorepoRoot: true });

const envVariables = dotenv.parse(fs.readFileSync('.env'));

const flyEnvVariables = Object.entries(envVariables)
	.map(([key, value]) => `${key}=${value}`)
	.join('\n');

execaCommandSync('flyctl secrets import', {
	input: flyEnvVariables,
	reject: false,
	stdout: 'inherit',
	stderr: 'inherit',
});

// execaCommandSync(
// 	'flyctl deploy --local-only --dockerfile ./packages/deployment/dockerfiles/Dockerfile',
// 	{ stdio: 'inherit' }
// );
