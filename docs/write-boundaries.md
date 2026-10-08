# 数据库写入边界

应用 `202610120001_write_boundaries.sql` 后，`anon`、`authenticated` 和 `PUBLIC` 无法直接 INSERT/UPDATE/DELETE 词条、论坛线程或帖子。已有读策略不变，服务角色种子导入仍可写入。

- 词条保存、提交、发布、回滚继续使用已有 RPC；管理员归档改用 `pw_archive_entry`，归档与审计同属一个事务。
- 论坛使用 `pw_create_forum_thread` 和 `pw_reply_forum_thread`。数据库验证邮箱，并通过 `profiles.author_id -> members.author_id` 派生身份；无成员绑定的读者使用账户展示名。调用者不能传入成员 ID 或作者名。
- 创建线程与首帖是一个事务。展示编号通过数据库事务锁分配，包含已有种子编号；新线程/帖子使用 UUID。旧 ID 和 URL 保持原样。

## 部署和恢复

先应用迁移，再部署对应应用版本。旧应用的论坛写入和归档会被新权限拒绝，因此应安排短暂维护窗口。迁移不删除数据，不更改已有修订、发布指针或论坛 ID。

回滚应用时仍保留收紧后的权限；应同时保留新 RPC 调用的兼容补丁。恢复旧直接写权限会重新打开身份伪造和审核绕过边界，不作为常规回滚步骤。

## 验证

只针对明确选定的本地测试实例运行：

```bash
supabase db reset
supabase db lint --local
supabase test db
node tools/test-forum-concurrency.mjs supabase_db_pioneer-wiki
```

pgTAP 覆盖角色权限、保存/审核/回滚、正文可见性、邮箱验证、身份派生、缺失/删除线程和首帖失败回滚。并发检查使用独立测试账户并在结束时清理自己创建的数据，不访问远程数据库。迁移 reset/lint 本身不能代替权限测试。
