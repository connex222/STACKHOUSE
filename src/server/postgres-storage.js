/** Optional durable room snapshot store; no card data is sent to other players.
 * Requires a PostgreSQL connection through pg. A compare-and-swap generation stops
 * two accidental service instances from overwriting one another's snapshots.
 */
const CREATE_TABLE=`CREATE TABLE IF NOT EXISTS stackhouse_room_snapshots (
  id smallint PRIMARY KEY CHECK (id=1),
  generation bigint NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
export class PostgresSnapshotStore {
  constructor(client) {this.client=client;this.generation=0;this.ready=false;}
  async load() {
    await this.client.query(CREATE_TABLE);
    const result=await this.client.query('SELECT generation,payload FROM stackhouse_room_snapshots WHERE id=1');
    const row=result.rows[0];
    this.generation=row?Number(row.generation):0;
    if(!Number.isSafeInteger(this.generation)||this.generation<0)throw Error('Invalid persisted room generation.');
    this.ready=true;
    return row?.payload??null;
  }
  async save(snapshot) {
    if(!this.ready)throw Error('Room database has not been loaded.');
    const payload=JSON.stringify(snapshot);
    let result;
    if(this.generation===0) {
      result=await this.client.query(`INSERT INTO stackhouse_room_snapshots(id,generation,payload)
        VALUES(1,1,$1::jsonb) ON CONFLICT(id) DO NOTHING RETURNING generation`,[payload]);
    } else {
      result=await this.client.query(`UPDATE stackhouse_room_snapshots SET
        payload=$1::jsonb,generation=generation+1,updated_at=now()
        WHERE id=1 AND generation=$2 RETURNING generation`,[payload,this.generation]);
    }
    if(!result.rows?.length)throw Error('Room snapshot conflict: another server changed the saved state. Restart to reload safely.');
    this.generation=Number(result.rows[0].generation);
  }
  /** Probe the database rather than assuming a configured URL means it is reachable. */
  async ping() {
    if (!this.ready) return false;
    try {
      await this.client.query('SELECT 1 AS stackhouse_ready');
      return true;
    } catch {
      return false;
    }
  }
  async close(){await this.client.end?.();}
}
export async function connectPostgresSnapshot(databaseUrl) {
  if(typeof databaseUrl!=='string'||!databaseUrl.trim())throw Error('Database URL missing.');
  const {Pool}=await import('pg');
  const pool=new Pool({connectionString:databaseUrl,max:2,connectionTimeoutMillis:8000,idleTimeoutMillis:30000});
  return new PostgresSnapshotStore(pool);
}
