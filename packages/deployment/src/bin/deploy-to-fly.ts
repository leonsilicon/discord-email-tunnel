import { execaCommandSync } from 'execa';
import { chProjectDir } from 'lion-system';
import * as fs from 'node:fs';

chProjectDir(import.meta.url, { monorepoRoot: true });

const envVariables = fs.readFileSync('.env', 'utf8');
execaCommandSync('flyctl secrets import', {
	input: envVariables,
	reject: false,
});

execaCommandSync(
	'flyctl deploy --local-only --dockerfile ./packages/deployment/dockerfiles/Dockerfile',
	{ stdio: 'inherit' }
);
