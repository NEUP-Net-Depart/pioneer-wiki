<p align="center">
  <img src="public/overture/m-map-avatar.webp" alt="Pioneer Wiki opening title: a map forming the letter P" width="120" />
</p>

<h1 align="center">Pioneer Wiki · 先锋维基</h1>

<p align="center">
  <b>A Natural History of Computer Science</b><br />
  一座按尺度、角色与关系编目的计算机科学博物馆。
</p>

<p align="center">
  <a href="https://github.com/NEUP-Net-Depart/pioneer-wiki/actions/workflows/ci.yml"><img src="https://github.com/NEUP-Net-Depart/pioneer-wiki/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/NEUP-Net-Depart/pioneer-wiki/releases"><img src="https://img.shields.io/github/v/release/NEUP-Net-Depart/pioneer-wiki" alt="Latest release" /></a>
  <a href="https://github.com/NEUP-Net-Depart/pioneer-wiki/stargazers"><img src="https://img.shields.io/github/stars/NEUP-Net-Depart/pioneer-wiki?style=flat" alt="GitHub stars" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="Strict TypeScript" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-Optional-3ECF8E?logo=supabase&logoColor=white" alt="Optional Supabase backend" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Code-Apache%202.0-333333?logo=apache" alt="Apache License 2.0" /></a>
</p>

<p align="center">
  <a href="#pioneer-wiki-chinese"><b>中文</b></a> · <a href="#pioneer-wiki-english"><b>English</b></a>
</p>

<p align="center">
  <a href="#快速开始">🚀 快速开始 / Quick start</a> ·
  <a href="#docker-部署">📦 部署 / Deployment</a> ·
  <a href="CONTRIBUTING.md">🤝 参与贡献 / Contributing</a> ·
  <a href="#special-thanks">❤️ Special Thanks</a> ·
  <a href="#friends">🌷 Friends</a> ·
  <a href="#sponsors">💛 Sponsors</a>
</p>

<table align="center">
  <tr>
    <td align="center"><img src="public/stage/biology.webp" width="180" alt="Natural history entrance: forest floor, birds and stream" /><br /><sub>I · 博物 Wiki · Natural history</sub></td>
    <td align="center"><img src="public/stage/geography.webp" width="180" alt="Geography entrance: layered coast, compass and lighthouse" /><br /><sub>II · 友链 Links · Geography</sub></td>
    <td align="center"><img src="public/stage/art.webp" width="180" alt="Fine art entrance: classical garden and figures" /><br /><sub>III · 成员 Members · Fine art</sub></td>
    <td align="center"><img src="public/stage/blueprint.webp" width="180" alt="Blueprint entrance: mechanical waterworks and power lines" /><br /><sub>IV · 交流 Forum · Blueprint</sub></td>
    <td align="center"><img src="public/stage/annals.webp" width="180" alt="Annals entrance: ledger album, tipped-in photographs, camera and quill" /><br /><sub>V · 纪行 Chronicles · Annals</sub></td>
  </tr>
</table>

<p align="center">
  <i>从一个概念出发，沿着关系认识一门学科。<br />Start with a concept. Follow its connections.</i>
</p>

> [!TIP]
> 想先逛一逛？本地开发默认使用 Mock 数据，安装依赖后即可启动，无需配置 Supabase。<br />
> To explore locally, install the dependencies and start the app. Mock data works without Supabase configuration.

---

<h2 id="pioneer-wiki-chinese">📖 先锋维基 · 中文</h2>

<details>
<summary><b>🧭 目录 · Contents</b></summary>

- [项目概览](#项目概览)
- [公开入口](#公开入口)
- [功能范围](#功能范围)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [数据源与环境变量](#数据源与环境变量)
- [Supabase 与认证部署](#supabase-与认证部署)
- [Docker 部署](#docker-部署)
- [项目结构](#项目结构)
- [参与贡献](#参与贡献)
- [特别感谢 · Special Thanks](#special-thanks)
- [Friends · 朋友名录](#friends)
- [爱发电赞助者 · Afdian Sponsors](#sponsors)
- [许可证](#许可证)

</details>

<h3 id="项目概览">🌿 项目概览</h3>

算法、系统与概念之间有怎样的联系？Pioneer Wiki 用自然史图鉴的方式整理计算机科学：为条目记录尺度、角色、来源和关系，让阅读既能深入一份档案，也能沿着关联继续探索。

这是一座使用 Next.js App Router 构建的中英双语知识维基，也是供成员展示作品、交流和记录活动的共同空间。五个入口分别借用博物、地理、艺术、蓝图与编年册的视觉语言，将知识与参与者放在同一份目录里。

条目保留双语正文、来源、作者和版本历史。公共读者只读取已发布修订；作者可以继续编写自己的草稿，管理员负责审核与发布。

<h3 id="公开入口">🏛️ 公开入口</h3>

| 部分 | 路由 | 内容组织方式 |
| --- | --- | --- |
| I · 博物 Wiki | `/` | 按领域、尺度、角色与关系浏览条目 |
| II · 友链 Links | `/links` | 以地理图志方式维护外部站点目录 |
| III · 成员 Members | `/members` | 成员名录与个人档案页 |
| IV · 交流 Forum | `/forum` | 主题、回复和分类讨论 |
| V · 纪行 Chronicles | `/chronicles` | 以编年册方式记录例会、归档与散页资料 |

另有条目详情与历史、关系图、全文检索、编辑器、账号和管理后台等路由。登录、写入和审核接口位于 `src/app/api`。

<h3 id="功能范围">✨ 功能范围</h3>

- **双语内容**：条目标题、摘要、正文和界面文案支持中文与 English；正文使用带有 GFM、代码高亮和数学公式支持的 Markdown 渲染器。
- **关系浏览**：条目之间可记录分类、依赖、对照、共生、来源等关系，并在关系图中查看。
- **版本与审核**：条目区分最新修订与已发布修订，支持草稿、送审、发布和归档流程。
- **检索与导航**：提供全文搜索、状态和作者筛选，以及跨入口的站内导航。
- **社区内容**：成员档案、讨论主题和回复使用独立的服务契约，便于在 Mock 与 Supabase 实现之间切换。
- **精选作品**：成员可在主页内策展最多 8 件作品，导入网站分享信息或公开 GitHub 仓库，补充介绍、图片、标签和体验／文档链接，并调整顺序。导入只填充预览，手动内容优先；网站预览是保存的快照，GitHub 公开数据每小时缓存，读取失败保留已有内容。详见[使用与部署说明](docs/member-projects.md)。
- **活动纪略**：纪行按日期编目例会、归档与散页资料；录像与文件一律外链，条目只登记标签、地址与参与成员。
- **账户边界**：邮箱验证、密码找回、成员/作者绑定、权限角色和追加式审计日志由认证与内容服务共同维护。
- **本地优先开发**：没有 Supabase 配置时使用确定性的内存 Mock 数据，不要求 Docker 或共享数据库即可运行和测试。

<h3 id="技术栈">🛠️ 技术栈</h3>

| 层 | 采用技术 |
| --- | --- |
| 应用框架 | Next.js 16 App Router、React 19 |
| 语言与样式 | Strict TypeScript、Tailwind CSS 4、项目自有纸张/档案视觉样式 |
| 内容处理 | `react-markdown`、`remark-gfm`、`remark-math`、KaTeX、代码高亮 |
| 数据与认证 | Mock service adapters；可选 Supabase Database、Auth、Storage |
| 测试与检查 | Vitest、ESLint、TypeScript、Playwright（前端流程） |
| 资源 | `public/` 下的 CC BY 4.0 AI 生成插图；提示词与清单保存在 `tools/` 和各资源目录 |

<h3 id="快速开始">🚀 快速开始</h3>

前置要求：Node.js 22.x 与 pnpm 10.34.6（版本固定在 `package.json` 的 `packageManager` 字段）。

```bash
git clone https://github.com/NEUP-Net-Depart/pioneer-wiki.git
cd pioneer-wiki
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm run dev
```

`pnpm-lock.yaml` 是唯一依赖锁文件。迁移已有 npm 检出时，先移除旧 `node_modules` 再安装，避免沿用 npm 提升的未声明依赖。

开发服务器默认运行于 <http://localhost:3000>。提交改动前运行适用的检查：

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

生产构建可以使用：

```bash
pnpm run build
pnpm start
```

<h3 id="数据源与环境变量">⚙️ 数据源与环境变量</h3>

> [!NOTE]
> 未配置 Supabase 时，项目使用 `src/mock` 中的内存 Mock 数据。本地探索和测试无需连接共享数据库。

需要明确固定为本地 Mock 时可设置：

```bash
PIONEER_DATA_SOURCE=mock
```

要启用持久化服务，请将 `.env.example` 复制为 `.env.local`，并设置：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PIONEER_DATA_SOURCE=supabase
```

> [!WARNING]
> `SUPABASE_SERVICE_ROLE_KEY` 仅用于服务端迁移、种子和管理员引导脚本，不能以 `NEXT_PUBLIC_` 前缀暴露，也不能提交到 Git。`.env.local` 已被 Git 忽略。

使用 Supabase 时，内容、搜索、社区、认证和成员图片 Storage 由对应适配器提供；公共读取仍只返回已发布修订。

<h3 id="supabase-与认证部署">🔐 Supabase 与认证部署</h3>

<details>
<summary><b>展开持久化、邮箱认证与首位管理员的配置步骤</b></summary>

1. 创建 Supabase 项目，启用邮箱/密码认证，并将站点 URL 和 `/auth/callback` 配置为允许的重定向地址。
2. 复制 `.env.example` 为 `.env.local`，设置公共项目 URL 和 anon key；服务角色密钥只保留在服务端。
3. 依次执行 `supabase/migrations` 下的迁移（账户、内容、编辑器工作草稿、纪行）。
4. 首个账号完成邮箱验证后，设置 `PIONEER_ADMIN_EMAILS`，再运行：

   ```bash
   pnpm run bootstrap-admin
   ```

5. 使用服务角色密钥运行幂等种子脚本，将现有本地 fixtures 导入所选项目：

   ```bash
   pnpm run seed-supabase
   ```

账号与公开成员页保持分离；只有管理员可以将账号绑定到 Wiki 作者或成员记录。内容写入会记录到追加式审计日志。不要在未明确选择项目的情况下运行种子或迁移命令。

</details>

<h3 id="docker-部署">📦 Docker 部署</h3>

<details>
<summary><b>展开预构建镜像、服务器构建与回滚说明</b></summary>

`Dockerfile` 分阶段构建，`runner` 只带 `.next/standalone`、`public/` 与追踪到的依赖，以非 root 用户运行。Supabase 配置在运行时读取，同一个镜像可连任意项目。

把 `wiki.example.com` 换成你自己的域名，`deploy/Caddyfile.example` 与 `deploy/deploy.sh` 用的是同一个占位域名。部署时需要：在 DNS 控制台把该域名的 A/AAAA 记录指向服务器 IP，或用 DNS CNAME 记录指向服务器的已有主机名；再按 `deploy/Caddyfile.example` 加载 Caddy 配置。Supabase Site URL 和允许的认证回调地址也要相应配置为 `https://<你的域名>` 和 `https://<你的域名>/auth/callback`。

内存小的服务器用预构建镜像：推一个 `v*` 版本 tag，CI 会在该 tag 上跑一遍门禁，绿了才由 `.github/workflows/release-image.yml` 构建镜像并发布 release（附带镜像、`docker-compose.yml`、`DEPLOY.txt` 与 `default.env.example`），在服务器上跑部署脚本即可。

在你想安装的目录里执行它（安装目录默认就是执行时的当前目录，`--dir PATH` 可改）：

```bash
mkdir -p /srv/pioneer-wiki && cd /srv/pioneer-wiki
curl -fsSL -o deploy.sh https://raw.githubusercontent.com/NEUP-Net-Depart/pioneer-wiki/main/deploy/deploy.sh
bash deploy.sh              # 或指定已发布版本：bash deploy.sh v0.1.2
```

它将 release 里的 `default.env.example` 保存为本地 `.env.example`，首次运行复制为 `.env` 后停下（填好 Supabase 两项再重跑），之后才下载镜像、`docker load` 并 `docker compose up -d`。已有 `.env` 不会被覆盖；旧版 `.env.example` 附件名仍兼容。镜像归档以 release 里的原名留在这个目录，不删。升级重跑同一条命令；回滚在 `.env` 里设 `PIONEER_IMAGE=pioneer-wiki:<tag>`。

内存充裕时直接在服务器上构建：

```bash
git clone https://github.com/NEUP-Net-Depart/pioneer-wiki.git && cd pioneer-wiki
cp .env.example .env        # 填 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
docker build -t pioneer-wiki:latest --target runner . && docker compose up -d
```

应用只监听 `127.0.0.1:3000`，交给宿主机已有的 Caddy 终止 TLS（`deploy/Caddyfile.example`）。首次部署前先在 Supabase 依次套用 `supabase/migrations`，再从本地跑一次 `pnpm run seed-supabase` 导入内容。构建期峰值内存随 CPU 核数增长，实测 24 核约 3.5 GB、4 核约 1 GB（历史 npm 构建测量，pnpm 下的峰值需重新测量）。

</details>

<h3 id="项目结构">🗂️ 项目结构</h3>

```text
src/app/                  路由、页面、API route handlers
src/components/           可复用的界面组件
src/lib/                  服务契约、Mock/Supabase 适配器、认证、Markdown 与搜索
src/mock/                 本地内容、成员、关系和社区 fixtures
src/styles/               全局、排版、动效与入口页样式
tests/                    auth、services、frontend 测试
public/                   浏览器可访问的插图与生成资源
tools/                    图片准备、管理员引导和 Supabase 种子脚本
deploy/                   预构建镜像的部署脚本与 Caddy 示例
friends/                  Friends 朋友名录与添加说明
supabase/migrations/      数据库与 Row Level Security 迁移
```

<h3 id="参与贡献">🤝 参与贡献</h3>

欢迎修复问题、补充条目、校对翻译、完善测试，或分享经过讨论的新功能。

- **报告问题**：使用 [Bug 报告](https://github.com/NEUP-Net-Depart/pioneer-wiki/issues/new?template=01-bug-report.yml)提供复现步骤。
- **讨论改动**：较大功能与数据模型调整先提交[工程任务](https://github.com/NEUP-Net-Depart/pioneer-wiki/issues/new?template=02-engineering-task.yml)。
- **提交贡献**：阅读[贡献指南](CONTRIBUTING.md)，提交面向组织仓库 `NEUP-Net-Depart/pioneer-wiki:main` 的 Pull Request。个人仓库 `main` 仅作镜像，合并后快进同步，不重复合并同一 PR。

贡献流程、AI 辅助贡献政策、Issue 模板和提交约定见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

> [!IMPORTANT]
> 所有改动通过面向组织仓库 `main` 的 Pull Request 合并。代码、认证、服务或双语内容的行为变化应补充回归测试；UI 改动应附真实浏览器验证的截图或录屏。

建议使用聚焦分支，例如 `fix/short-description`、`feature/short-description`、`docs/short-description` 或 `test/short-description`，并使用简短的 Conventional Commits 提交信息。

<h3 id="许可证">📄 许可证</h3>

- 源代码与文档：Apache License 2.0，见 [`LICENSE`](LICENSE)。
- `public/` 下现有 AI 生成插图：Creative Commons Attribution 4.0 International（CC BY 4.0），见 [`LICENSE-ILLUSTRATIONS.md`](LICENSE-ILLUSTRATIONS.md)。
- 新增图片、字体或外部资源必须确认许可证兼容，并在需要时保留署名和来源。

---

<h2 id="pioneer-wiki-english">📖 Pioneer Wiki · English</h2>

<details>
<summary><b>🧭 Contents</b></summary>

- [Overview](#overview)
- [Public areas](#public-areas)
- [Feature scope](#feature-scope)
- [Technology](#technology)
- [Quick start](#quick-start)
- [Data sources and environment](#data-sources-and-environment)
- [Supabase and authentication deployment](#supabase-and-authentication-deployment)
- [Docker deployment](#docker-deployment)
- [Repository layout](#repository-layout)
- [Contributing](#contributing)
- [Special Thanks](#special-thanks)
- [Friends](#friends)
- [Afdian Sponsors](#sponsors)
- [License](#license)

</details>

<h3 id="overview">🌿 Overview</h3>

How do algorithms, systems and concepts connect? Pioneer Wiki catalogues computer science as a natural history, recording each entry's scale, role, sources and relations. Read an individual archive, then follow its connections into the wider subject.

Built with the Next.js App Router, this bilingual wiki also gives members a shared space for projects, discussions and records of activity. Its five entrances draw on natural history, geography, fine art, blueprints and annals to bring knowledge and its contributors into one catalogue.

Entries retain bilingual bodies, sources, authors and revision history. Public readers see published revisions; authors continue their own drafts, while administrators review and publish them.

<h3 id="public-areas">🏛️ Public areas</h3>

| Area | Route | Organisation |
| --- | --- | --- |
| I · Wiki | `/` | Entries by domain, scale, role and relation |
| II · Links | `/links` | An external-site directory presented as a gazetteer |
| III · Members | `/members` | Member index and individual profile pages |
| IV · Forum | `/forum` | Categorised threads and replies |
| V · Chronicles | `/chronicles` | The society's annals: meetings, filings and loose material |

The application also provides entry detail and history pages, a relation graph, full-text search, an editor, account pages and an administration area. Sign-in, write and review endpoints live under `src/app/api`.

<h3 id="feature-scope">✨ Feature scope</h3>

- **Bilingual content**: entry titles, summaries, bodies and interface copy support Chinese and English. Markdown rendering includes GFM, code highlighting and mathematical notation.
- **Relation browsing**: entries can record taxonomy, dependency, contrast, symbiosis and source relations, then expose them in a graph view.
- **Revision and review workflow**: latest and published revisions are kept separate, with draft, review, publish and archive states.
- **Search and navigation**: full-text search, status and author filters, and shared navigation connect the public areas.
- **Community content**: member profiles, forum threads and replies use service contracts that can be backed by Mock or Supabase adapters.
- **Selected works**: members can curate up to 8 projects, import website sharing information or public GitHub repositories, add their own text, images, tags and demo/docs links, and arrange the order. Imports leave authored content intact; website previews are saved snapshots, GitHub public data is cached for an hour, and remote failures retain existing content. See the [usage and deployment notes](docs/member-projects.md).
- **Annals of activity**: chronicles catalogue meetings, filings and loose material by date; recordings and files stay at their own addresses, with only their labels, links and the members present recorded here.
- **Account boundaries**: email verification, password recovery, account/member binding, roles and append-only audit logs are maintained by the auth and content services.
- **Local-first development**: without Supabase configuration, deterministic in-memory fixtures run locally without Docker or a shared database.

<h3 id="technology">🛠️ Technology</h3>

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19 |
| Language and styling | Strict TypeScript, Tailwind CSS 4, custom paper/archive visual styles |
| Content | `react-markdown`, `remark-gfm`, `remark-math`, KaTeX and syntax highlighting |
| Data and auth | Mock service adapters; optional Supabase Database, Auth and Storage |
| Checks | Vitest, ESLint, TypeScript and Playwright for browser flows |
| Assets | CC BY 4.0 AI-generated illustrations under `public/`; prompts and manifests under `tools/` and asset folders |

<h3 id="quick-start">🚀 Quick start</h3>

Requirements: Node.js 22.x and pnpm 10.34.6 (pinned by `packageManager` in `package.json`).

```bash
git clone https://github.com/NEUP-Net-Depart/pioneer-wiki.git
cd pioneer-wiki
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm run dev
```

`pnpm-lock.yaml` is the sole dependency lockfile. When migrating an existing npm checkout, remove the old `node_modules` before installing to avoid retaining undeclared dependencies hoisted by npm.

The development server runs at <http://localhost:3000>. Run the applicable checks before submitting a change:

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

To run the production build locally:

```bash
pnpm run build
pnpm start
```

<h3 id="data-sources-and-environment">⚙️ Data sources and environment</h3>

> [!NOTE]
> Without Supabase configuration, the app uses in-memory Mock fixtures from `src/mock`. Local exploration and tests do not need a shared database.

Set the following variable to force the Mock implementation:

```bash
PIONEER_DATA_SOURCE=mock
```

To enable persistence, copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PIONEER_DATA_SOURCE=supabase
```

> [!WARNING]
> `SUPABASE_SERVICE_ROLE_KEY` is server-only and is used only for migrations, seeding and the administrator bootstrap script. It must never use a `NEXT_PUBLIC_` prefix or be committed. `.env.local` is ignored by Git.

With Supabase enabled, the content, search, community, auth and member-cover Storage adapters provide persistence. Public reads continue to expose published revisions only.

<h3 id="supabase-and-authentication-deployment">🔐 Supabase and authentication deployment</h3>

<details>
<summary><b>Persistence, email authentication and the first administrator</b></summary>

1. Create a Supabase project, enable email/password auth, and configure the site URL and `/auth/callback` as allowed redirect targets.
2. Copy `.env.example` to `.env.local` and set the public project URL and anon key. Keep the service-role key server-side.
3. Apply the migrations under `supabase/migrations` in filename order (accounts, content, editor working drafts, chronicles).
4. After the first account verifies its email, set `PIONEER_ADMIN_EMAILS` and run:

   ```bash
   pnpm run bootstrap-admin
   ```

5. With the service-role key configured, import the existing fixtures into the selected project:

   ```bash
   pnpm run seed-supabase
   ```

Accounts and public member pages remain separate. Only an administrator can bind an account to a Wiki author or member record. Content writes are recorded in an append-only audit log. Do not run seed or migration commands against an unselected project.

</details>

<h3 id="docker-deployment">📦 Docker deployment</h3>

<details>
<summary><b>Prebuilt images, server builds and rollback</b></summary>

The `Dockerfile` builds in stages: `runner` keeps only `.next/standalone`, `public/` and the traced dependencies, and runs as an unprivileged user. Supabase settings are read at runtime, so one image serves any project.

Replace `wiki.example.com` with your own domain; `deploy/Caddyfile.example` and `deploy/deploy.sh` use the same placeholder. Then point the DNS A/AAAA records for that domain at the server IP, or use a DNS CNAME record pointing at its existing hostname, and load the Caddy configuration from `deploy/Caddyfile.example`. Configure the Supabase Site URL and allowed callback as `https://<your-domain>` and `https://<your-domain>/auth/callback`.

On a host with little memory, use the prebuilt image: pushing a `v*` version tag runs CI on that commit, and once it passes `.github/workflows/release-image.yml` builds the image and publishes the release with the image, `docker-compose.yml`, `DEPLOY.txt` and `default.env.example` attached. One script installs them.

Run it from the directory you want the install in — the install directory is the current directory unless `--dir PATH` says otherwise:

```bash
mkdir -p /srv/pioneer-wiki && cd /srv/pioneer-wiki
curl -fsSL -o deploy.sh https://raw.githubusercontent.com/NEUP-Net-Depart/pioneer-wiki/main/deploy/deploy.sh
bash deploy.sh              # or a specific published version: bash deploy.sh v0.1.2
```

It saves the release's `default.env.example` locally as `.env.example`, copies it to `.env` on the first run and stops there so the two Supabase values can be filled in; re-running it downloads the image, loads it and runs `docker compose up -d`. An existing `.env` is preserved, and the old `.env.example` attachment name remains supported. The image archive stays in that directory under its release name. Updating repeats the same command; roll back with `PIONEER_IMAGE=pioneer-wiki:<tag>` in `.env`.

With memory to spare, build on the host instead:

```bash
git clone https://github.com/NEUP-Net-Depart/pioneer-wiki.git && cd pioneer-wiki
cp .env.example .env        # NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
docker build -t pioneer-wiki:latest --target runner . && docker compose up -d
```

The app listens on `127.0.0.1:3000` only, leaving TLS to an existing Caddy on the host (`deploy/Caddyfile.example`). Before the first deployment, apply `supabase/migrations` in the Supabase project and import content once with `pnpm run seed-supabase` from a checkout. Peak build memory scales with the CPU count — measured at about 3.5 GB on 24 cores and 1 GB on four (historical npm build measurements; pnpm peaks must be measured again).

</details>

<h3 id="repository-layout">🗂️ Repository layout</h3>

```text
src/app/                  Routes, pages and API route handlers
src/components/           Reusable interface components
src/lib/                  Service contracts, Mock/Supabase adapters, auth, Markdown and search
src/mock/                 Local content, member, relation and community fixtures
src/styles/               Global, prose, motion and entrance-page styles
tests/                    Auth, service and frontend tests
public/                   Browser-served illustrations and generated assets
tools/                    Image preparation, admin bootstrap and Supabase seed scripts
deploy/                   Deploy script and Caddy example for the prebuilt image
friends/                  Friends directory and instructions for adding names
supabase/migrations/      Database and Row Level Security migrations
```

<h3 id="contributing">🤝 Contributing</h3>

Bug fixes, new entries, translation edits, tests and discussed features are welcome.

- **Report a bug** with reproducible steps in the [Bug Report](https://github.com/NEUP-Net-Depart/pioneer-wiki/issues/new?template=01-bug-report.yml) form.
- **Discuss a larger change** through the [Engineering Task](https://github.com/NEUP-Net-Depart/pioneer-wiki/issues/new?template=02-engineering-task.yml) form.
- **Send a contribution** by following the [contribution guide](CONTRIBUTING.md) and opening a pull request targeting `NEUP-Net-Depart/pioneer-wiki:main`. The personal `main` is a mirror, fast-forwarded after the organization merge; do not merge the same PR twice.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution path, AI-assisted contribution policy, issue templates and commit conventions.

> [!IMPORTANT]
> All changes are merged through a pull request targeting the organization's `main`. Add regression coverage for behaviour changes in code, auth, services or bilingual content; UI changes should include a real-browser screenshot or recording.

Use a focused branch such as `fix/short-description`, `feature/short-description`, `docs/short-description` or `test/short-description`, and keep commit subjects short and Conventional Commits compatible.

<h3 id="license">📄 License</h3>

- Source code and documentation: Apache License 2.0, see [`LICENSE`](LICENSE).
- Existing AI-generated illustrations under `public/`: Creative Commons Attribution 4.0 International (CC BY 4.0), see [`LICENSE-ILLUSTRATIONS.md`](LICENSE-ILLUSTRATIONS.md).
- New images, fonts and external assets must have a compatible licence and retain required attribution and source information.

---

<h2 id="special-thanks">❤️ 特别感谢 · Special Thanks</h2>

感谢每一位为 Pioneer Wiki 提交代码、内容、翻译、测试与文档的贡献者。<br />
Thank you to everyone who contributes code, content, translations, tests and documentation to Pioneer Wiki.

<a href="https://github.com/NEUP-Net-Depart/pioneer-wiki/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=NEUP-Net-Depart/pioneer-wiki&amp;max=200&amp;columns=14&amp;v=2" alt="Pioneer Wiki contributors / 先锋维基贡献者" />
</a>

<sub>头像墙由 <a href="https://contrib.rocks">contrib.rocks</a> 根据 GitHub 贡献记录自动生成；点击查看完整贡献者列表。<br />Avatars are generated by contrib.rocks from GitHub contribution records. Click to view the full list.</sub>

<table align="center">
  <tr>
    <td align="center">
      <a href="https://github.com/PeterPtroc">
        <img src="https://github.com/PeterPtroc.png?size=96" width="96" height="96" alt="PeterPtroc" />
      </a>
      <br />
      <sub><b><a href="https://github.com/PeterPtroc">PeterPtroc</a></b></sub>
    </td>
  </tr>
</table>

---

<h2 id="friends">🌷 Friends · 朋友名录</h2>

这里记录一路支持、交流与陪伴 Pioneer Wiki 的朋友们。<br />
Friends who support Pioneer Wiki and share in its journey are listed here.

<div align="center">
  <a href="https://github.com/gibeon">
    <img src="https://github.com/gibeon.png?size=96" width="96" height="96" alt="gibeon" />
  </a>
  <br />
  <sub><b><a href="https://github.com/gibeon">gibeon</a></b></sub>
</div>

完整名录与添加方式见 [`friends/README.md`](friends/README.md)。<br />
See [`friends/README.md`](friends/README.md) for the directory and how to add a name.

---

<h2 id="sponsors">💛 爱发电赞助者 · Afdian Sponsors</h2>

感谢通过爱发电支持 Pioneer Wiki 的朋友。名单将在获得公开确认后补充。<br />
Thank you to everyone who supports Pioneer Wiki through Afdian. Publicly confirmed sponsors will be listed here.

<div align="center">
  <p><b>暂无赞助者 · No sponsors yet</b></p>
</div>

<!-- Add confirmed public sponsor names here, following the centered layout above. -->

---

<p align="center"><sub>Pioneer Wiki · 先锋维基</sub></p>
