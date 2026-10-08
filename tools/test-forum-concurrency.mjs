import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const container = process.argv[2];
if (!container || !/^supabase_db_[a-z0-9-]+$/.test(container)) {
  throw new Error("Pass the explicit local Supabase database container name.");
}
const userIds = Array.from({ length: 8 }, () => randomUUID());
const userId = userIds[0];
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
const sessionFor = (id) =>
  `begin; set local role authenticated; do $$begin perform set_config('request.jwt.claim.sub', '${id}', true); end$$;`;
const session = sessionFor(userId);

try {
  await sql(
    `insert into auth.users(id, email, email_confirmed_at) values ${userIds.map((id, i) => `('${id}', '${marker}-${i}@example.test', now())`).join(",")};`,
  );
  const threads = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      sql(
        `${sessionFor(userIds[i])} select public.pw_create_forum_thread('${marker}', 'Opening post', 'help'); commit;`,
      ).then(JSON.parse),
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
  const quotaWrites = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      sql(`${session} select public.pw_create_forum_thread('${marker}', 'Quota opening', 'help'); commit;`),
    ),
  );
  assert.equal(quotaWrites.filter((result) => result.status === "fulfilled").length, 4);
  assert.equal(quotaWrites.filter((result) => result.status === "rejected").length, 4);
  for (const result of quotaWrites) {
    if (result.status === "rejected") assert.match(result.reason.message, /rate_limited/);
  }
  console.log(
    "PASS: 8 accounts create unique threads; 12 concurrent replies; one account cannot exceed its 5-thread quota.",
  );
} finally {
  await sql(
    `delete from public.forum_threads where title = '${marker}'; delete from auth.users where id in (${userIds.map((id) => `'${id}'`).join(",")});`,
  );
}
