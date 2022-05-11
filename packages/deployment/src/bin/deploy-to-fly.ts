import { execaCommandSync } from 'execa';
import { chProjectDir } from 'lion-system';
import * as fs from 'node:fs';

chProjectDir(import.meta.url, { monorepoRoot: true });

const envVariables = fs.readFileSync('.env', 'utf8');
execaCommandSync('flyctl secrets import', {
	input: envVariables,
});
execaCommandSync(
	'flyctl launch --dockerfile ./packages/deployment/dockerfiles/Dockerfile'
);
