> **🌐 语言 / Language**: [中文](#贡献指南) | [English](#contributing-to-pioneer-wiki)

---

# 贡献指南

感谢你为 Pioneer Wiki 做贡献！这是一个公开仓库，欢迎 Bug 修复、文档改进、测试、翻译和经过讨论的功能改动。

## 贡献路径

- 组织成员可以在仓库中直接创建主题分支；外部贡献者请先 Fork 仓库。
- 所有改动都必须通过 Pull Request 合并到组织仓库 `NEUP-Net-Depart/pioneer-wiki` 的 `main`，不要直接推送新改动到 `main`。
- 仓库提供结构化的 [Bug 报告](.github/ISSUE_TEMPLATE/01-bug-report.yml) 和 [工程任务](.github/ISSUE_TEMPLATE/02-engineering-task.yml) 模板。

> [!TIP]
> 小修复、文档和测试可以直接提交 PR。较大功能、数据模型调整或 Supabase 变更，请先创建 Issue 说明问题和方案，再开始实现。

### 组织主线与个人镜像

组织仓库的 `main` 是唯一主线；`puresky271/pioneer-wiki` 的 `main` 保持为同一个提交。主题分支可以推送两边，但同一改动只向组织仓库开一个 PR。不要在个人仓库再独立合并或 squash，否则文件相同也会出现 ahead/behind。

组织 PR 合并后，维护者授权同步个人镜像时使用以下流程。先用 `git remote -v` 确认 `neup` 指向组织仓库、`origin` 指向个人仓库；别名不同时替换命令中的名称。

```bash
git remote -v
git fetch --no-tags neup main
git fetch --no-tags origin main
git merge-base --is-ancestor origin/main neup/main
```

只有祖先检查退出码为 0 才继续普通推送；非 0 时停止并检查分叉，不能直接强推。

```bash
git push origin refs/remotes/neup/main:refs/heads/main
git fetch --no-tags origin main
git rev-parse neup/main origin/main
git rev-list --left-right --count neup/main...origin/main
```

两个提交哈希必须相同，最后一条输出必须为 `0 0`。该操作不切换或重置本地工作区。若推送期间远端发生变化，应重新核对。

已有分叉的修复需另外获得维护者明确授权：先保存个人旧 `main` 的备份分支或 Git bundle，核对文件差异及独有补丁，再只对个人 `main` 使用带准确旧 SHA 的 `--force-with-lease=refs/heads/main:<verified-old-sha>`。不要为消除个人镜像分叉向组织仓库添加纯历史合并，也不要改写组织 `main`。

后续版本标签在组织主线合并后创建一次，个人主线同步后将同一个标签对象推送两边。已发布的历史标签保持原样，即使它们曾指向不同提交。

## AI 辅助贡献政策

> [!IMPORTANT]
> 欢迎使用 AI 工具，但提交者必须理解、检查并对最终 PR 负责。

- 你需要理解改动的目标、范围、行为变化和验证结果。
- AI 生成的代码必须经过人工检查，不要直接提交未经验证的复制内容。
- 保持 PR 聚焦，避免把无关重构、格式化或生成文件混在一起。
- 行为变化需要测试，UI 或交互变化必须提供截图或录屏。
- 如果某项自动化检查不适用，请在 PR 中说明原因和人工验证方式。

## 快速开始

### 前置要求

- Node.js 22.x（CI 使用的版本）
- pnpm 10.34.6（通过 Corepack 使用项目固定版本）
- 需要验证 UI 时使用可运行本项目的现代浏览器

### 浏览器测试边界

`pnpm run test:e2e` 只运行 Playwright 管理的 Chromium 公共页面冒烟测试。它使用 Mock 数据和生产构建，不连接 Supabase，不登录账号，也不代表 Firefox、WebKit、真实数据库或用户本机浏览器的兼容性。

CI 会在安装依赖后执行 `pnpm exec playwright install --with-deps chromium`，因此 GitHub runner 和贡献者都不需要预装 Chrome 或 Chromium。首次本地运行前执行：

```bash
pnpm exec playwright install chromium
pnpm run build
pnpm run test:e2e
```

本地若希望复用系统 Chrome，需要使用专门的浏览器调试脚本；仓库 CI 的结果以 Playwright 管理的 Chromium 为准。

### 本地运行

```bash
git clone https://github.com/NEUP-Net-Depart/pioneer-wiki.git
cd pioneer-wiki
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm run dev
```

依赖变更需提交 `pnpm-lock.yaml`；不要再生成 `package-lock.json`。原 npm 检出请先移除旧 `node_modules` 再安装。依赖安装脚本必须在 `pnpm-workspace.yaml` 的 `allowBuilds` 中经过明确审核。

> [!NOTE]
> 默认使用内存 Mock 数据，不需要 Supabase 密钥。需要强制使用本地模拟账户时设置 `PIONEER_DATA_SOURCE=mock`。

使用真实 Supabase 时，请参考 `.env.example`，并绝不要提交 `SUPABASE_SERVICE_ROLE_KEY` 或其他密钥。

## 开始修改

从组织仓库最新的 `main` 创建主题分支（先确认 `neup` 的 URL）：

```bash
git fetch --no-tags neup main
git switch -c fix/short-description neup/main
# 或 feature/short-description、docs/short-description、test/short-description
```

提交信息使用简短的 Conventional Commits 风格，例如：

```text
fix: prevent duplicate revision titles
feat: add member profile editing
docs: explain local mock data
test: cover auth validation edge case
```

遵循现有 TypeScript 和 React 风格：两空格缩进、双引号、分号；组件和组件文件使用 PascalCase，函数和变量使用 camelCase，URL 段和静态资源使用 kebab-case。优先使用 `@/*` 导入别名，并将共享逻辑放在 `src/lib` 或 `src/components`。注释应简洁地说明意图、约束或不明显的行为，并在 `//` 和块注释标记后留空格。ESLint 抑制必须写出具体规则，并以 `-- 原因` 说明例外；禁止无规则的 `eslint-disable`、重复抑制和已经没有作用的抑制。JSDoc 标签使用标准拼写并保持对齐。

## 验证改动

根据改动范围运行适用检查。代码 PR 在提交前至少运行：

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

Vitest 测试位于 `tests/auth`、`tests/services` 和 `tests/frontend`，文件使用 `*.test.ts` 命名。服务、认证、解析器或双语内容发生行为变化时，请添加回归测试。UI 变化还应运行 `pnpm run dev`，在受影响页面完成真实流程，并在 PR 中附截图或录屏。

## 提交 Pull Request

PR 描述请包含：

1. 问题背景、解决方案和用户影响。
2. 关联 Issue，例如 `Closes #123`；较大功能应先有讨论记录。
3. 执行过的验证命令及结果。
4. UI 或行为变化的截图、录屏或前后对比。
5. Supabase migration、环境变量、媒体资源或许可证方面的额外步骤。

维护者会根据 CI、测试、范围聚焦程度、兼容性和可回滚性进行评审。CI 失败时，请在更新 PR 前说明失败原因或修复方式。

## 资源与许可证

代码和文档采用 Apache License 2.0，详见 [LICENSE](LICENSE)。`public/` 下现有 AI 生成插图按 CC BY 4.0 发布，详见 [LICENSE-ILLUSTRATIONS.md](LICENSE-ILLUSTRATIONS.md)。新增图片、字体或其他资源必须确认兼容许可，并在需要时保留作者、来源和署名信息。不要提交 API 密钥、账号信息或未脱敏的诊断日志。

---

# Contributing to Pioneer Wiki

Thank you for contributing to Pioneer Wiki. This public repository welcomes bug fixes, documentation, tests, translations, and feature work that has been discussed when the scope is substantial.

## Contribution Path

- Organization members may create topic branches in the repository; outside contributors should start from a fork.
- Every change must reach `NEUP-Net-Depart/pioneer-wiki:main` through a pull request. Do not push new changes directly to `main`.
- Use the structured [Bug Report](.github/ISSUE_TEMPLATE/01-bug-report.yml) and [Engineering Task](.github/ISSUE_TEMPLATE/02-engineering-task.yml) forms.

> [!TIP]
> Small fixes, documentation and tests may go straight to a pull request. Discuss larger features, data-model changes and Supabase changes in an Issue before implementation.

### Canonical main and personal mirror

The organization's `main` is canonical; `puresky271/pioneer-wiki:main` mirrors its exact commit. Topic branches may be pushed to both repositories, but open and merge one PR against the organization. Independently merging or squashing the same change in the fork creates ahead/behind counts even when file contents match.

After the organization PR is merged and a maintainer authorizes mirror synchronization, verify remote URLs first. These commands assume `neup` is the organization and `origin` is the personal fork; replace aliases when needed.

```bash
git remote -v
git fetch --no-tags neup main
git fetch --no-tags origin main
git merge-base --is-ancestor origin/main neup/main
```

Continue only when the ancestor check exits with code 0. Otherwise stop and inspect the divergence instead of force-pushing.

```bash
git push origin refs/remotes/neup/main:refs/heads/main
git fetch --no-tags origin main
git rev-parse neup/main origin/main
git rev-list --left-right --count neup/main...origin/main
```

Both head SHAs must match and the last command must print `0 0`. This does not switch or reset the local checkout. Recheck if a remote changes during the push.

Repairing existing divergence requires separate, explicit maintainer authorization: back up the old personal head with a branch or Git bundle, review file differences and unique patches, then use `--force-with-lease=refs/heads/main:<verified-old-sha>` only on the personal fork. Do not add a history-only merge to the organization or rewrite its `main` to repair the mirror.

Create each new release tag once on the merged organization main, synchronize the personal main, and push the same tag object to both repositories. Preserve all published historical tags, including tags that originally pointed at different commits.

## AI-Assisted Contributions

> [!IMPORTANT]
> AI tools are welcome, but the contributor must understand, review and take responsibility for the final pull request.

Understand its goal, scope, behavior changes, and verification results; review generated code manually; keep the change focused; and add regression tests for behavior changes. UI or interaction changes must include screenshots or a recording. When automation is not applicable, explain the reason and the manual verification performed.

## Getting Started

Use Node.js 22.x and pnpm 10.34.6 (the version pinned by `packageManager`):

```bash
git clone https://github.com/NEUP-Net-Depart/pioneer-wiki.git
cd pioneer-wiki
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm run dev
```

Commit `pnpm-lock.yaml` with dependency changes; do not generate `package-lock.json`. Remove the old `node_modules` before installing in an existing npm checkout. Review dependency install scripts explicitly in `allowBuilds` in `pnpm-workspace.yaml`.

> [!NOTE]
> The default backend uses in-memory mock data. Set `PIONEER_DATA_SOURCE=mock` to force the local simulated account.

For Supabase development, follow `.env.example`; never commit `SUPABASE_SERVICE_ROLE_KEY` or any other secret.

Create a focused branch from the latest organization `main`: after verifying the `neup` URL, run `git fetch --no-tags neup main` and `git switch -c fix/short-description neup/main`. Other examples include `feature/short-description`, `docs/short-description`, or `test/short-description`. Use short Conventional Commits such as `fix: ...`, `feat: ...`, `docs: ...`, and `test: ...`.

## Verification

Before submitting a code PR, run:

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

Tests live under `tests/auth`, `tests/services`, and `tests/frontend` and use the `*.test.ts` naming pattern. Add regression coverage for service, auth, parser, or bilingual-content behavior. For UI changes, run the affected flow locally and include visual evidence in the PR.

## Pull Requests

Explain the problem, solution, user impact, linked Issue, validation commands, and any screenshots or recordings. Call out Supabase migrations, environment variables, media assets, and licensing steps. Keep each PR focused and respond to CI failures with either a fix or a clear explanation.

## Assets and License

Code and documentation are licensed under Apache License 2.0. Existing AI-generated illustrations under `public/` are CC BY 4.0; see [LICENSE-ILLUSTRATIONS.md](LICENSE-ILLUSTRATIONS.md). New images, fonts, and other assets must have compatible licenses and retain required attribution. Never commit secrets, account data, or unsanitized diagnostics.
