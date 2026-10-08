import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const container = process.argv[2];
if (!container || !/^supabase_db_[a-z0-9-]+$/.test(container)) {
  throw new Error("Pass the explicit local Supabase database container name.");
}
const userId = randomUUID();
const marker = `concurrency-${userId}`;

function sql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr))));
    child.stdin.end(statement);
  });
}
const session = `begin; set local role authenticated; do $$begin perform set_config('request.jwt.claim.sub', '${userId}', true); end$$;`;

try {
  await sql(
    `insert into auth.users(id, email, email_confirmed_at) values ('${userId}', '${marker}@example.test', now());`,
  );
  const threads = await Promise.all(
    Array.from({ length: 8 }, () =>
      sql(`${session} select public.pw_create_forum_thread('${marker}', 'Opening post', 'help'); commit;`).then(
        JSON.parse,
      ),
    ),
  );
  assert.equal(new Set(threads.map((thread) => thread.id)).size, 8);
  assert.equal(new Set(threads.map((thread) => thread.number)).size, 8);
  for (const thread of threads) {
    assert.equal(await sql(`select count(*) from public.forum_posts where thread_id = '${thread.id}';`), "1");
  }
  const replies = await Promise.all(
    Array.from({ length: 12 }, () =>
      sql(`${session} select public.pw_reply_forum_thread('${threads[0].id}', 'Concurrent reply'); commit;`).then(
        JSON.parse,
      ),
    ),
  );
  assert.equal(new Set(replies.map((post) => post.id)).size, 12);
  assert.equal(await sql(`select count(*) from public.forum_posts where thread_id = '${threads[0].id}';`), "13");
  console.log("PASS: 8 concurrent threads with opening posts; 12 concurrent replies; unique IDs and numbers.");
} finally {
  await sql(
    `delete from public.forum_threads where title = '${marker}'; delete from auth.users where id = '${userId}';`,
  );
}
