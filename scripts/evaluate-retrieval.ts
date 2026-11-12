import { readFile } from 'node:fs/promises';
import {
  evaluateRetrieval,
  evaluationManifest,
  type EmbeddingArtifact,
} from './retrieval-evaluation';
async function main() {
  if (process.argv.includes('--manifest')) {
    console.log(JSON.stringify(evaluationManifest(), null, 2));
    return;
  }
  const index = process.argv.indexOf('--embeddings');
  const artifact: EmbeddingArtifact | undefined =
    index < 0 ? undefined : JSON.parse(await readFile(process.argv[index + 1], 'utf8'));
  console.log(JSON.stringify(await evaluateRetrieval(artifact), null, 2));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
