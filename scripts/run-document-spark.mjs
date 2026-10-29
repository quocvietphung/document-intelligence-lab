import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function sparkBatchArgs(snapshot,repeat=1,id=randomUUID()){
  if(!/^[a-f0-9]{64}\/etl-[a-f0-9-]{36}$/.test(snapshot))throw Error('Copy the scope/run pair from Data Pipelines → Analytics → Parquet / PySpark.');
  if(!Number.isInteger(repeat)||repeat<1||repeat>10000)throw Error('Repeat must be an integer from 1 to 10000. Repetition creates synthetic rows, not more PDFs.');
  if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid run UUID');
  const compose=['compose','-f','docker-compose.yml','-f','docker-compose.platform.yml','-f','docker-compose.etl.yml','-f','docker-compose.ml.yml','-f','docker-compose.spark.yml','--profile','spark'];
  return {compose,run:[...compose,'run','--rm','--no-deps','--build','spark','--input',`/etl/assets/${snapshot}`,'--output',`/data/spark/${id}`,'--repeat',String(repeat)],output:`/data/spark/${id}/benchmark.json`};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const flags=process.argv.slice(2);
  if(flags[0]==='--help'){console.log('node scripts/run-document-spark.mjs --snapshot <scope>/<etl-run> [--repeat <1..10000>]');process.exit(0);}
  if(flags[0]!=='--snapshot'||!flags[1]||(flags.length!==2&&(flags.length!==4||flags[2]!=='--repeat')))throw Error('Use --help for the explicit snapshot command.');
  const batch=sparkBatchArgs(flags[1],flags[3]===undefined?1:Number(flags[3]));
  const run=args=>{const result=spawnSync('docker',args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Spark batch failed; existing PDFs and databases were preserved.');};
  run([...batch.compose,'run','--rm','--no-deps','analytics-init']);run(batch.run);console.log('Private benchmark saved in the analytics volume: '+batch.output);
}
