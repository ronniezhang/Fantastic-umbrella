# fantasticumbrella.com — Astro 静态前台

B2B 站点的 Astro 源码仓库。**主域名已于 2026-11-15 完整切流到 Cloudflare Pages**，WordPress 不再对外服务（GoDaddy 托管订阅与 DNS 记录保留作回退）。2026-11-16 起全站提供英文 / 西班牙语 / 法语 / 德语四个语种，详见第 11 节。

日期：2026-11-16

---

## 1. 当前状态

| 项 | 值 |
| --- | --- |
| 线上地址 | **https://fantasticumbrella.com/**（Cloudflare Pages，有效 HTTPS）；预览域名 https://fantastic-umbrella-e13.pages.dev/ |
| 静态页 | **76**（19 个英文页 × 4 语种：首页 + 5 个 B2B 页 + 产品列表 + 12 个产品页） |
| 多语言 | `en` 保持无前缀 URL；`/es/`、`/fr/`、`/de/` 前缀；全站 hreflang + `x-default` + 自指 canonical；语言切换器保持当前页面路径 |
| 构建产物 | `dist/` 纯静态 HTML，零运行时脚本 |
| 产品范围 | 手持小伞 8 款主推、沙滩伞 4 款附带；14 款沙滩椅/天幕/庭院伞移出至 GreenMark |
| 范围规则 | `src/data/catalog-scope.json`（唯一事实源；`npm run sync` 已被 guard 冻结，见第 3 节） |
| 询盘表单 | Astro 原生渲染，POST 到同源 Pages Function `/api/enquiry`；表单按语种显示文案并带 `_locale`，邮件标题按语种打标（EN/ES/FR/DE）。详见第 8 节 |
| 图片 | 12 张产品图已本地化到 `public/images/products/`，**不再依赖 WP** |
| sitemap | `scripts/make-sitemap.mjs` 在 prebuild 生成，**76 条 URL**，每条带 4 语种 hreflang alternates |
| 301 | `public/_redirects`（Cloudflare Pages 格式）+ `dist/.htaccess`（Apache 格式），各 19 条 |
| SEO | canonical / description / Organization JSON-LD + hreflang 全站覆盖；7 组 Title/Meta 在 `src/data/seo.json` |
| 自动部署 | GitHub Actions `deploy-pages.yml`：push `main` 或 `workflow_dispatch` → `npm ci → npm run build → wrangler pages deploy dist --project-name=fantastic-umbrella` |

`astro.config.mjs` 的 `site` 指向主域名，canonical 与 sitemap 均生成 `https://fantasticumbrella.com/...`，切流后即为正式 URL。预览域名由 `functions/robots.txt.ts` 保持 `Disallow: /`，不会被当作正式站收录。

---

## 2. 目录结构

```
astro-prototype/
├── astro.config.mjs          # build.format: 'directory'（保住尾斜杠 URL，勿改）
├── package.json
├── public/
│   ├── _redirects            # 19 条 301（Cloudflare Pages）
│   ├── sitemap.xml           # prebuild 自动生成，76 条 URL + hreflang
│   ├── robots.txt            # 正式版：Allow / + Sitemap
│   ├── sw.js / 404.html      # 迁移期 SW 清理 / 旧 WP 路径软 404 修复
│   └── images/products/      # 12 张本地产品图
├── functions/                # Pages Functions：/api/enquiry、robots.txt
├── scripts/
│   ├── make-sitemap.mjs      # 生成四语种 sitemap（prebuild 自动跑）
│   ├── verify-i18n.mjs       # 词典/正文/产品译文完整性校验（prebuild 自动跑）
│   ├── extract-page-texts.mjs# 从英文页抽取待译文本节点
│   ├── guard-legacy-sync.mjs # 冻结两个旧 WP 同步脚本
│   ├── sync-content.mjs      # ⚠ 旧：从 wp-json 拉内容（已被 guard 拦截）
│   ├── catalog-scope.mjs     # 产品范围判定 + 正文术语修正
│   ├── rebuild-scope.mjs     # ⚠ 旧：离线重算目录（已被 guard 拦截）
│   ├── make-htaccess.mjs     # _redirects → Apache RewriteRule
│   └── make-preview.mjs      # 生成预览部署副本
├── src/
│   ├── i18n/                 # config / routes / html / dict + ui|pages|products 词典
│   ├── data/                 # 英文内容数据（去 WP 后的唯一内容源，必须入库）
│   ├── layouts/Base.astro    # html lang / hreflang / canonical / 语言切换脚本
│   ├── components/           # Header / Footer / EnquiryForm
│   ├── components/pages/     # 共享页面组件，路由薄壳只传 locale
│   ├── pages/                # en：index / [slug] / products / product/[slug]
│   ├── pages/es|fr|de/       # 三个语种的同构薄壳路由
│   └── styles/global.css
└── dist/                     # 构建产物（gitignore）
```

---

## 3. 常用命令

```bash
npm ci
npm run verify:i18n    # 校验四语种词典结构、文本节点数、产品 slug 一致性
npm run build          # prebuild 自动跑校验 + 生成 sitemap → dist/；postbuild 生成 .htaccess
npm run preview        # 本地预览 http://127.0.0.1:4321/
npm run preview:stage  # → ../astro-preview/（纯静态部署副本）
```

> ⚠️ **旧 WP 同步脚本已冻结**：`npm run sync` / `npm run rebuild-scope` 现在默认被 `scripts/guard-legacy-sync.mjs` 拦截并报错。它们会用单语种内容覆盖 `src/data/*.json`、`public/sitemap.xml`、`public/_redirects`、`public/robots.txt`，抹掉 es/fr/de 的 sitemap 与 hreflang，还会把产品图改回 `wp-content` 外链（WP 已下线即图片全裂）。确需重跑时用 `ALLOW_LEGACY_SYNC=1 npm run sync -- --force`，跑完必须重新执行 `npm run verify:i18n && npm run build` 并复核图片本地化。日常改动直接改 `src/data/` 与 `src/i18n/`，不要走同步脚本。

---

## 4. 部署方式

**Cloudflare Pages（推荐）**
- Build command：`npm run build`
- Output directory：`dist`
- `public/_redirects` 自动生效，19 条 301 无需额外配置
- 绑定自定义域名 = 切流，必须单独授权

**Apache / 普通虚拟主机**
- 上传 `dist/` 内容，用 `dist/.htaccess` **整体替换**（不要追加在 WP rewrite 之后）
- 其中 `/我的购物车/ → /contact/` 需人工复核后再启用

**不要用**：把 `dist/` 手动 FTP 覆盖到现有 GoDaddy Managed WordPress 运行时——那套 WPaaS v2 不允许换成纯静态站，且自带的 Cloudflare 缓存（首页 `max-age` 31 天）无法从用户侧 purge。

---

## 5. Git 状态与推送

代码已推送到 **https://github.com/ronniezhang/Fantastic-umbrella** 的 `main` 分支（2026-11-14）。本机 Git Credential Manager 已缓存写入凭据，后续提交直接 `git push` 即可。

在新克隆的机器上：

```bash
git clone https://github.com/ronniezhang/Fantastic-umbrella.git
cd Fantastic-umbrella
npm ci
npm run build
```

推送权限建议使用细粒度 PAT 或 SSH deploy key，不要用平台主账号密码。仓库为公开仓库，**不要提交 `.env`、API 密钥或任何凭据**（`.gitignore` 已排除）。

---

### 5.1 Cloudflare Pages 接入参数（账号开好后照填）

| 字段 | 值 |
| --- | --- |
| 创建路径 | Workers & Pages → Create application → Pages → Connect to Git |
| Git 仓库 | `ronniezhang/Fantastic-umbrella`（公开 / 私有均可） |
| Production branch | `main` |
| Framework preset | Astro（或留空，手填下面两项） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空 |
| Environment variables | `NODE_VERSION = 20`（Astro 5 要求 Node ≥ 18.17.1 / 20.3+，固定 20 避免默认版本过旧） |
| 首次部署产物 | `<project>.pages.dev`，**无需自定义域名、无需改 DNS** |

注意：

- 用 Git 集成创建的项目之后**不能**切换成 Direct Upload（官方限制）；本仓库本来就走 Git，无影响。
- 绑定 **apex 主域名** `fantasticumbrella.com` 按官方要求必须把域名加为 Cloudflare zone，并把 NS 从 GoDaddy 改到 Cloudflare —— **这一步就是切流，需站点负责人明确授权**。子域名则只需一条 CNAME 指向 `<project>.pages.dev`，且必须先在 Pages 面板走 "Add a custom domain"，否则会返回 522。
- 免费计划额度：500 次构建/月、100 个自定义域名、20,000 文件、2,000 条静态重定向、无限预览部署。本站 19 页 / 19 条 301 远低于限额。
- GoDaddy Managed WordPress 套餐自带的 Cloudflare CDN 属于 **GoDaddy 的账号**，与这里新建的 Cloudflare 账号互相独立；新开账号不会接管或影响现有 CDN。

### 5.2 自动化部署：只需一条最小权限凭据

Cloudflare 面板 URL 不含登录态，自动化必须靠 API Token（或在已登录浏览器里开启浏览器控制）。**最小权限、可随时撤销、绝不写进仓库**：

1. Cloudflare 面板右上角头像 → **My Profile → API Tokens → Create Token → Create Custom Token → Get started**
   - Token name：`pages-deploy-fantastic-umbrella`
   - Permissions：**Account / Cloudflare Pages / Edit**（Account-level，官方 CI 文档指定的权限）
   - Account Resources：Include / All accounts（或只选 `13add9388b385c07b6484bff948ef043`）
   - **Client IP Address Filtering：留空**，不要填任何 IP
   - Token expiration：可留空（No expiration）
   - Continue to summary → Create Token → 复制完整值（`cfut_` 开头，**只显示一次**）
2. GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**
   - `CLOUDFLARE_API_TOKEN` = 上一步的完整值（也可直接贴给我，由我用仓库公钥加密写入，不落盘）
   - `CLOUDFLARE_ACCOUNT_ID` = `13add9388b385c07b6484bff948ef043`（**已写入，无需再配**）
3. **已配置完成（2026-11-14）**：两个 Secret 均已写入，GitHub Actions run `43555572828` 全部步骤 success，站点运行在 `https://fantastic-umbrella-e13.pages.dev/`（`fantastic-umbrella.pages.dev` 被占用，Cloudflare 自动加 `-e13` 后缀）。

**实测结论与坑（2026-11-14）**：

- **真正的致命项只有 Client IP Address Filtering**。设了单 IP 白名单的 token 会被 Cloudflare 以 `403 / 9109 Cannot use the access token from location: <ip>` 拒绝；GitHub Actions 出站 IP 来自 8,350 个动态 IPv4 CIDR（`api.github.com/meta` 实测），不可能白名单。去掉该限制后 `/accounts/{id}`、`/accounts/{id}/pages/projects` 均返回 200。
- **更正此前判断**：官方兼容矩阵虽把 Pages 标为 ❌（针对 account-owned token），但实测 `cfat_` 前缀的 Account API Token 在无 IP 限制时**可以成功创建项目并完成 `wrangler pages deploy`**。它用 `/accounts/{account_id}/tokens/verify` 验证（`/user/tokens/verify` 会 401）。长期仍建议换成最小权限的 **User API Token**（`cfut_`，My Profile → API Tokens）——当前 token 权限接近全账号，且已在对话里明文出现过。
- **wrangler 4.86 在非交互 CI 不会自动新建项目**：首次部署报 `Project not found [code: 8000007]`。需先调 `POST /accounts/{account_id}/pages/projects`，body 最小为 `{"name":"fantastic-umbrella","production_branch":"main"}`（省略 `source` 即 Direct Upload），之后 workflow 才能上传。
- 官方模板里**没有** "Edit Cloudflare Pages"，只能走 Custom Token 手动添加 `Account / Cloudflare Pages / Edit` 权限。

拿到 token 后先验证再写入 Secret：User token 用 `/user/tokens/verify`，Account token 用 `/accounts/{account_id}/tokens/verify`，确认返回 `status: active`。

仓库已带 `.github/workflows/deploy-pages.yml`：push 到 `main` 即自动 `npm ci → npm run build → wrangler pages deploy dist`，之后改一句文案 `git push` 就发布。两个 Secret 未配置时 workflow 会安全跳过，不产生失败记录。

**取舍（重要）**：wrangler 部署创建的是 **Direct Upload** 项目，官方明确它之后**不能切换成 Git 集成**。若以后想要面板里原生的 GitHub 关联与 PR 预览部署，需删除并重建项目；`git push` 自动发布由 GitHub Actions 提供，不受影响。

**预览期 SEO**：workflow 在部署前把 `dist/robots.txt` 覆写为 `Disallow: /`，且全站 canonical 仍指向主域名，避免 `*.pages.dev` 被当成正式站收录。**切流绑主域名时必须删掉这一步**，恢复 `public/robots.txt`（含 sitemap）。

**不要做**：把 Cloudflare 主账号密码或 Global API Key 发出来；把 token 写进任何文件；在授权前点 **Add a custom domain**。

---

## 6. 切流前的硬门槛（未完成不得改 DNS）

1. 询盘端点 `/api/enquiry` 已部署上线并通过线上验收（第 8 节）；仍需在 Pages 项目填投递通道的环境变量，并**发一封真实询盘确认邮箱/群消息收到**
2. 12 个 `wp-content` 图片本地化 + 中文文件名重命名
3. Yoast 的 meta description 从数据库导出（REST 不暴露该字段）
4. 3 个法务/关于页 + 9 个分类页补齐
5. 邮箱 `sales@fantasticumbrella.com` 归属核实（是否绑在 GoDaddy 主机套餐里）
6. 站点负责人明确授权后才动 GoDaddy DNS

---

## 7. 预览部署（Cloudflare Pages）

**正式预览地址：https://fantastic-umbrella-e13.pages.dev/**

由 GitHub Actions `deploy-pages.yml` 自动构建并 Direct Upload 到 Cloudflare Pages 项目 `fantastic-umbrella`。`git push` 到 `main` 即自动发布，也可在 Actions 页手动 Run workflow。只承接预览流量，**主域名 DNS 未改、未绑定自定义域名**。

2026-11-14 实测（run `43555572828` 全步骤 success）：

| 检查 | 结果 |
| --- | --- |
| 首页 | 200 / 9.4 KB / 1 个内联脚本 / canonical 指向主域名 |
| 6 个 B2B 页 + 产品页 | 全部 200 |
| robots / sitemap | `Disallow: /`；`sitemap.xml` 200 |
| 19 条 301 | **18 条生效**；唯一未生效的是中文路径 `/我的购物车/`（编码后未匹配），切流前需人工复核 |
| 图片 | 12 个 `wp-content` 绝对外链仍返回 200（依赖线上 WP，去 WP 前必须本地化） |
| 表单 | **已接通**：`POST /api/enquiry` 线上返回 400 校验 / 503 未配置 / 403 跨源，均符合预期；前端带一键邮件兜底。run `43560263612` 全步骤 success（含端点存活自检）。仅差投递通道环境变量 |

预览期 `robots.txt` 由 workflow 覆写为 `Disallow: /`，**切流绑主域名时必须删掉 workflow 里那一步**恢复正式 robots。备用临时链接 `https://wbapp-72hb4123vtqk7gaufcq75x.app.workbuddy.host/?sharecode=4IFW5XU2RU` 仍可访问，但它不是生产托管。

---

## 8. 询盘表单接在哪里、怎么开

**不需要 CMS。** CMS（WordPress / Sanity / Contentful）解决的是「谁来编辑页面和产品」，表单解决的是「谁接收一次 POST」。静态 Astro 站只能返回预先生成好的 HTML，本身**收不了 POST**；缺的是一个接收端，不是一套内容后台。只有将来要「多人分派询盘、标记已报价、跟单状态、对接 CRM」时才需要数据库/后台，而且那叫 CRM 或工单系统，仍然不是 CMS。

本项目的接收端是 `functions/api/enquiry.ts`：Cloudflare Pages Function，和静态站**同一个项目、同一个域名**，路由 `/api/enquiry`。部署时 Wrangler 会自动把 `functions/` 编译成 `_worker.js` 一起上传，静态页面照常走 CDN 缓存，只有这一个 API 路径走边缘计算。

```
访客填表  →  POST /api/enquiry  →  Pages Function（校验 + 反垃圾）
                                 ├→ Resend 邮件 API   → 销售邮箱
                                 ├→ 企业微信/飞书/Slack webhook → 群消息
                                 └→ 第三方表单服务（Formspree 等）→ 其后台 + 邮件
```

密钥全部放在 Pages 环境变量里，**不会下发到浏览器**。三种通道可单独用，也可同时开做冗余；只要有一个投递成功就返回成功，全部失败返回 502 让用户改发邮件，绝不「假装收到」。

### 当前状态（2026-11-15）：正式发件域已上线

Zoho 侧早已闭环（MX / SPF / DKIM / DMARC 全通过、收发双向实测）。Resend 后台已于 2026-11-15 确认 `notify.fantasticumbrella.com` **Verified / Resend Forge Ready**（事件链：Domain added → DNS verified → Domain verified），随后完成正式发件域切换。API key 通过 **GitHub Actions Secrets 加密写入**，CI 每次部署前由 `scripts/sync-pages-env.py` 自动同步到 Cloudflare Pages（**Production + Preview 同时写**），不需要手动去 Pages 后台填变量。

| 项 | 当前值 | 说明 |
| --- | --- | --- |
| 投递通道 | Resend 邮件 | `RESEND_API_KEY` + `ENQUIRY_TO` 已绑定，线上 `GET /api/enquiry` 实测 `delivery.email=true` |
| 发件人 | `Fantastic Umbrella <no-reply@notify.fantasticumbrella.com>` | 已验证的发信子域，客户看到的不再是 `resend.dev` |
| 收件人 | `sales@fantasticumbrella.com` | Zoho 企业邮箱；2026-11-15 三封自检询盘全部落收件箱，询盘统一在 Zoho 收发 |
| 认证 | SPF（Return-Path `send.notify` CNAME 委托）+ DKIM（选择器 `resend`）+ DMARC 对齐 | 对齐域为 `notify.fantasticumbrella.com`；主域 DMARC `p=none sp=none` |
| 密钥存放 | GitHub Secrets（加密） | 明文不入库、不落盘、不进浏览器；CI 用 Cloudflare API 写成 `secret_text` |

**域名验证实测（2026-11-15 15:11）**：GoDaddy 加入 Resend 生成的 3 条记录，经 `8.8.8.8` + 权威 `ns29` 双源复核生效：`resend._domainkey.notify` TXT（DKIM 公钥，选择器 `resend`）、`send.notify` CNAME → `send.forge.rmta.net.`、`rsend.notify` CNAME → `rsend-apne1.forge.rmta.net.`。**Resend 新版由 CNAME 委托目标提供 SPF（Return-Path 域承担 SPF 检查），`notify` 本身不需要 SPF TXT**；DKIM TXT 只有 `p=` 无 `v=DKIM1` 前缀也属正常。主域 A / NS / MX ×3 / 两条 TXT / `_dmarc` 全部未动。详见落地清单「15:11」章。

**切换动作（2026-11-15 15:30）**：确认后台 Verified 后，只更新两个 Secret（`ENQUIRY_TO`、`ENQUIRY_FROM`），`RESEND_API_KEY` 原值保持不变（工作区根目录 `set_github_secrets.py` 支持部分更新，无需重新输入 key）→ 重跑 Actions → CI 同步 Pages 变量并重新部署 → 只读自检 `mode=verified-domain`、`from=no-reply@notify.fantasticumbrella.com`。**代码零改动**：`functions/api/enquiry.ts` 的 `mode` 本就按 `from` 自动判定。

**只读自检**：`GET /api/enquiry` 返回 `{ok, delivery:{email,webhook,forward}, mode, from, to}`，**不含密钥**（`to` 是网站公开的业务邮箱，用于排障）。CI 在部署后会检查 `delivery.email === true`，变量没绑上直接让工作流失败，不会「假绿」。

**投递延迟已闭环（2026-11-15 15:52）**：15:30 自检信发出后，15:37 在 Zoho 收件箱还没看到；到 15:52 三封测试信（`Pipeline QA` 3:45、`Delivery Diagnostics` 3:43、`Delivery Check 2` 3:48）**全部出现在 Zoho 收件箱（非垃圾邮件）**，发件人显示 `Fantastic Umbrella`，10 个字段、`Submitted` 时间、`Source page` 全部正确；双收件人那封同时到达 `sales@` 与 Gmail。结论：**不是丢单，也不是配置错误，而是新验证域名 + Resend Forge 首批发信的排队 / 预热延迟**（约 10–15 分钟）；Zoho 并未把 `notify.` 子域来信当作仿冒本组织域拦截。临时加的 Gmail 副本已撤掉，`ENQUIRY_TO` 改回单一 `sales@fantasticumbrella.com`。

端点保留诊断模式备查：POST 带 `_diag: true` 或请求头 `X-Enquiry-Diag: 1` 会返回实际 `to` / `from`、Resend 上游状态码与邮件 id。`GET /emails/:id` 因 key 为 `restricted_api_key`（仅发送）返回 401，属预期，邮件状态仍以 Resend 后台 Logs 为准。

**最终验收**：运行 `npm run verify:enquiry`（或在 Contact 页提交一次），会发一封 `Pipeline QA` 自检询盘到 `sales@`。看到 `200 ok`、收件箱收到、Reply-To 是客户地址，即全链路闭环。

**为什么 Resend 必须走子域**：主域 SPF 只能有一条且已归属 Zoho，两个发信源各要一条会冲突、认证随机失败；子域验证还能隔离人工邮件与网站通知的发信信誉。当前主域 DMARC `p=none sp=none`；**将来收紧到 `quarantine` / `reject` 前，先确认 `notify.` 子域的 SPF/DKIM 对齐仍通过**，否则询盘通知可能被拒收。

**失败兜底**：任何投递失败仍保留**携带全部已填字段的一键预填邮件**（指向已验证的 `sales@`），端点 502/503 返回明确地址与 `fallback` 字段，不会静默丢单。`npm run verify:enquiry -- --no-send` 可在不发信的情况下显示 `delivery.email` 与 `mode`。

### 环境变量（Pages 项目 → Settings → Environment variables，Production + Preview 都要填）

| 变量 | 用途 | 是否必填 |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend 的 API key（`re_...`），勾 Encrypt | 走邮件时必填 |
| `ENQUIRY_TO` | 收件人，多个用逗号分隔 | 走邮件时必填 |
| `ENQUIRY_FROM` | 发件人，当前 `Fantastic Umbrella <no-reply@notify.fantasticumbrella.com>`（用**已验证的发信子域**，不要复用主域 `sales@`） | 可选；未设置时回退到 `onboarding@resend.dev` 沙箱 |
| `ENQUIRY_WEBHOOK_URL` | 企业微信 / 飞书 / Slack / 自建接口 URL，自动识别格式 | 可选 |
| `ENQUIRY_FORWARD_URL` | 第三方表单服务接收地址 | 可选 |
| `ENQUIRY_FORWARD_FORMAT` | 设 `form` 时按 `x-www-form-urlencoded` 转发（Formsubmit 等需要），默认 JSON | 可选 |
| `PUBLIC_ENQUIRY_ENDPOINT` | **构建时**变量，改前端 POST 目标；默认 `/api/enquiry`，正常不用动 | 可选 |

改完环境变量要**重新部署一次**才生效（Pages 在部署时把变量绑定进版本）。本项目不需要手动去 Pages 后台填：三个值存在 GitHub Secrets 里，由工作流里的 `Sync Pages environment variables` 步骤通过 Cloudflare API 自动写入 Production + Preview，改 Secret 后重跑一次 Actions 即可。

### 通道 A：发到邮箱（推荐，最像原来的 Fluent Forms）

1. 注册 [Resend](https://resend.com)（免费额度 100 封/天、3000 封/月），拿 `RESEND_API_KEY`。
2. 测试期可用默认 `onboarding@resend.dev`，但**只能发给 Resend 注册邮箱**；正式用必须验证**发信子域** `notify.fantasticumbrella.com`（而不是主域）。本项目已于 2026-11-15 完成验证，Resend 新版 Records 页给出的是 **CNAME 委托**：`send.notify` → `send.forge.rmta.net.`、`rsend.notify` → `rsend-apne1.forge.rmta.net.`，外加 `resend._domainkey.notify` TXT（DKIM）；**`notify` 本身不需要 SPF TXT**，SPF 由 Return-Path 域的委托目标提供。**原因**：一个域名只能有一条 SPF TXT，主域那条要留给企业邮箱（MX 服务商），两个服务商各要一条就会冲突；子域独立验证还能把网站通知的发信信誉与人工邮件隔离。只加发信验证的记录，**不动 A 记录、不动 NS、不影响网站托管**。详细 DNS 清单见上级目录 `fantasticumbrella_询盘邮件链路选型与落地清单_2026-11-14.md`。
3. 填 `ENQUIRY_TO=sales@fantasticumbrella.com`。**该地址已于 2026-11-14 实测可用**：MX ×3 生效，Gmail 原始邮件头 `spf=pass` / `dkim=pass` / `dmarc=pass`（DKIM 选择器 `fantastic`），Hotmail / Gmail 来信进 Zoho 收件箱、`sales@` 发往 Gmail 也进收件箱。
4. 重新部署 → 在 Contact 页提交一封真实询盘 → 确认收到、确认「回复」按钮落到客户邮箱（端点已设 `reply_to`）。

### 通道 B：发到企业微信 / 飞书 / Slack 群（不用域名验证，最快）

在群里加一个机器人拿 webhook URL，填 `ENQUIRY_WEBHOOK_URL` 即可。端点按 URL 自动选格式：`qyapi.weixin.qq.com` → `msgtype:text`，`open.feishu.cn` → `msg_type:text`，`hooks.slack.com` → `{text}`，其他 → 原始 JSON。适合「询盘立刻有人看到」，但**收件箱里没有存档**，建议和通道 A 一起开。

### 通道 C：第三方表单服务（最省事，但客户资料过第三方）

Formspree / Forminit（原 Getform，2026-01 更名）：注册后拿表单 URL，填 `ENQUIRY_FORWARD_URL`（JSON 即可）。Formsubmit.co 之类需要表单编码的，再设 `ENQUIRY_FORWARD_FORMAT=form`。免费额度很小（Formspree 约 50 条/月、Forminit 约 100 条/月且仅 1 个表单），且超额处理方式不同——Formspree 存起来待升级后可取回，Forminit 据其文档会直接拒收且不保存。费用、留存与隐私条款需自行评估，B2B 客户公司名、邮箱、采购量会经过该服务。正式站点建议用通道 A/B，自建端点没有提交数上限。

### 自检

```bash
curl -s -X POST https://fantastic-umbrella-e13.pages.dev/api/enquiry \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Test","company":"Test Co","email":"test@example.com","country":"DE","product_interest":"Golf umbrella","estimated_quantity":"500 pcs","message":"Endpoint check","_form_time":0}'
```

未配置任何通道时返回 `503 {"ok":false,"error":"not_configured"}`；配置成功后完整提交返回 `200 {"ok":true}`。**当前已配置**（2026-11-15 实测 `GET /api/enquiry` → `delivery.email=true`、`mode=verified-domain`、`from=no-reply@notify.fantasticumbrella.com`），真实自检询盘用下方一键验收命令。

**一键验收**（切正式发件域后跑一次即可）：

```bash
npm run verify:enquiry                       # 检查站点 + 端点 + 同源防护，并发一封真实测试询盘
npm run verify:enquiry -- --no-send         # 只检查链路，不发信
npm run verify:enquiry -- --url https://fantasticumbrella.com   # 切主域后改用它
```

`200 ok` = 投递通道已通且测试询盘已发出；`503 not_configured` = 端点正常、只差环境变量；`502` = 通道都配了但全部投递失败，需要排查。端点彻底不返回 JSON 时脚本以退出码 1 报错。也可用 `node ../test_enquiry_endpoint.mjs` 跑本地逻辑自测（上级工作目录，12 个用例）。

**兜底降级**：任何一种失败（503 未配置、502 投递全挂、404 端点不存在、访客断网）都会在表单下方显示原因，并附一个**一键预填邮件**按钮 —— 客户已经填写的 10 个字段会自动写进邮件主题和正文，收件人是已实测可用的 `sales@fantasticumbrella.com`，点一下就在本地邮件客户端生成一封完整询盘。因此预览期即使还没填密钥，也不会静默吞掉线索；这不是普通 `mailto:` 死链，而是一条可用的备用提交通路（正文按邮件客户端上限截断到 1800 字符）。

**线上状态（2026-11-15 已闭环）**：`functions/` 已被 Wrangler 自动打包随 `pages deploy` 上线；投递通道三个变量已由 CI 同步到 Pages，真实自检询盘已落入 Zoho `sales@` 收件箱（详见 §8）。`503 not_configured` 只在变量被清空时才会出现，届时仍有一键预填邮件兜底。

端点已内置的防护：同源 Origin 校验、蜜罐字段、`1.5s` 极速提交拦截、必填/邮箱/长度校验、`no-store`、请求不落第三方日志。若后续询盘量起来，再加 Cloudflare Turnstile（免费、无验证码打扰）与 D1 存档。

---

## 10. 主域名切流到 Cloudflare Pages（2026-11-15 已完成）

**官方约束**：Cloudflare 文档《Custom domains》明确 —— **裸域 `fantasticumbrella.com` 要绑到 Pages，域名必须成为该 Cloudflare 账号下的 zone 并把 NS 指向 Cloudflare**；外部 DNS（GoDaddy）只能给 `www` 这类子域加 CNAME 到 `fantastic-umbrella-e13.pages.dev`。原因：apex 不能有 CNAME（与 SOA/NS/MX 冲突），Cloudflare 靠自有权威 DNS 的 CNAME flattening 解决。**当前无 CAA 记录**，Cloudflare 可正常签发 Universal SSL 证书。

### 已在代码侧完成的切流准备（CI 全绿）

| 项 | 处理 | 验证 |
| --- | --- | --- |
| 12 张产品图原为 `https://fantasticumbrella.com/wp-content/...` 绝对外链，WP 下线即破图 | 全部下载到 `public/images/products/{slug}.{ext}`，`src/data/products.json` 改成本地路径（3.6 MB，JPEG/PNG 文件头均有效） | 构建 19 页；预览站 `/images/products/fan-spray-umbrella.jpg` 返回 `200 image/jpeg 417901` |
| CI 原先把 `dist/robots.txt` 强制写成 `Disallow: /`，主域切过来会被全站禁止收录 | 删除该覆盖；新增 `functions/robots.txt.ts` 按域名返回：主域 `Allow: /` + Sitemap，预览/其他域名 `Disallow: /`；CI 新增「Verify host-aware robots.txt」校验标记 | run `43699616984` 全绿；预览域名实测返回带 `# served-by: pages-function` 的 Disallow |

⚠️ **不要再跑 `npm run sync`**：`scripts/sync-content.mjs` 会从 WP REST 重新抓取，把 `image` 字段写回 wp-content 绝对地址，切流后会重新破图。产品数据现在以 `src/data/catalog-scope.json` + 本地 `products.json` 为准。

### Cloudflare 侧已执行（2026-11-15 17:42，改 NS 前完成）

通过一次性工作流 `.github/workflows/cf-admin.yml` + `scripts/cf-zone-setup.py`（复用仓库里已有的 Cloudflare 凭据，密钥不落日志）完成：

| 项 | 结果 |
| --- | --- |
| Zone | 新建 `fantasticumbrella.com`，id `cf90d809b72119d0012a5bbffb2a307c`，type=full，status=`pending`（等 NS 生效） |
| **GoDaddy 要填的 2 个 NS** | **`adi.ns.cloudflare.com`**、**`damiete.ns.cloudflare.com`** |
| DNS 记录 | Cloudflare 自动扫描抓到 0 条，脚本从当前权威 DNS（GoDaddy）逐字读取并写入 **14 条**，全部 `proxied=False`（DNS only，邮件记录不能开代理） |
| TXT 完整性 | 8 条 TXT 与 GoDaddy 现值逐字比对**全部 MATCH**（含 Zoho DKIM 234 字符、Resend DKIM 218 字符，无截断） |
| Pages 自定义域 | `fantasticumbrella.com` 与 `www.fantasticumbrella.com` 均已添加，status=`pending`；NS 生效后 Cloudflare 自动创建 apex CNAME flattening + www CNAME 并签发 Universal SSL 证书 |

**GoDaddy 侧暂时不用改任何记录**（A / MX / TXT 全部保留作回退）。唯一要做的：把域名的 Nameservers 从 `ns29 / ns30.domaincontrol.com` 换成上面两个 Cloudflare NS。改 NS 之前，Cloudflare 里的一切对公网不可见。

#### GoDaddy 常见误区：DNS 记录表里的 NS 行不能改（2026-11-15 17:50）

用户截图确认：GoDaddy「DNS 紀錄」表格里 `@` 的两条 NS（`ns29 / ns30.domaincontrol.com`）的「編輯 / 刪除」图示为灰色禁用。**这是正常设计，不是域名被锁**。GoDaddy 官方帮助明确写道：「如果您的域名使用 GoDaddy 域名服务器，我们将为您处理默认的 NS 记录，您将无法编辑或删除这些默认记录」以及「NS 记录不是您域名的域名服务器；如需更改域名服务器，需要执行不同的步骤」。DNS 记录表里的 NS 行只用于**子域委派**，改不了注册商层面的委派。

正确入口（繁中界面 / 英文对照）：

1. 回到 **我的產品 / My Products → 網域組合 / Domain Portfolio**，点 `fantasticumbrella.com` 进入 **網域設定 / Domain Settings**（不要停留在 DNS 紀錄表格）。
2. 找到独立的 **名稱伺服器 / Nameservers** 卡片 → 点 **變更 / Change**（官方路径：`Domain Settings → DNS → Nameservers`，通常在记录表上方或页面下方的单独区块）。
3. 选 **我要使用自己的名稱伺服器 / I'll use my own nameservers (custom)**，移除原有两条，填 `adi.ns.cloudflare.com` 与 `damiete.ns.cloudflare.com`。
4. **儲存 / Save → 繼續 / Continue**；若开启 Domain Protection，会要求简讯验证码或注册信箱的一次性密码。
5. GoDaddy 可能警告「会中断 GoDaddy 托管的网站」—— Managed WordPress 绑定域名时会出现，**照常确认即可**，这正是下线 WP 的目标；Zoho 邮箱与托管产品无关，不受影响。改完后 GoDaddy 的 DNS 紀錄页仍会显示旧记录，但已不再权威，不要在那里删东西。

若进入 Nameservers 后**仍**提示无法修改，按顺序排查：① 域名转发（Forwarding）开启会占用记录 → 先关闭；② Domain Protection / 注册锁定 → 按提示完成验证或暂时关闭域名锁定；③ Website Builder / Managed WordPress 产品锁住 DNS → 请 GoDaddy 客服解锁；④ 仍不行则改走路径 B（只绑 `www` + 裸域 301），完全不动 NS。

官方参考：GoDaddy Help《Edit my domain nameservers》(`change-nameservers-for-my-domains-664`)、《編輯 NS 記錄》(`19213`)。

> ⚠️ 过渡窗口：NS 生效后到 Cloudflare 自动创建 apex CNAME、签发证书之间，网站可能短暂打不开（通常几分钟，证书最长几十分钟）。**MX 与全部邮件 TXT 已在 Cloudflare 侧齐备，Zoho 收发不会断。** 回退只需把 NS 改回 `ns29 / ns30.domaincontrol.com`。

### DNS 迁移清单（改 NS 前逐条核对，一条都不能少）

2026-11-15 17:30 从 `8.8.8.8` 只读实测的**全部**记录。Cloudflare 建 zone 时会自动扫描导入，但必须人工比对 —— 少一条 MX/TXT 就可能让客户邮件退信或询盘认证失败。

| 类型 | 名称 | 值 | 迁移要求 |
| --- | --- | --- | --- |
| MX | `@` | `10 mx.zoho.com` / `20 mx2.zoho.com` / `50 mx3.zoho.com` | **必须保留**，丢了收不到客户邮件 |
| TXT | `@` | `v=spf1 include:dc-8e814c8572._spfm.fantasticumbrella.com ~all` | **必须保留** |
| TXT | `@` | `zoho-verification=zb38467186.zmverify.zoho.com` | 保留 |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:sales@fantasticumbrella.com; pct=100` | **必须保留**，继续 `p=none` |
| TXT | `fantastic._domainkey` | `v=DKIM1; k=rsa; p=MIGfMA0G...` | **必须保留**（Zoho DKIM，选择器 `fantastic`） |
| TXT | `dc-8e814c8572._spfm` | `v=spf1 include:zohomail.com ~all` | **必须保留**（主域 SPF 的 include 目标） |
| TXT | `resend._domainkey.notify` | `p=MIGfMA0G...` | **必须保留**（询盘通知 DKIM） |
| CNAME | `send.notify` | `send.forge.rmta.net` | **必须保留**（Resend SPF/Return-Path 委托） |
| CNAME | `rsend.notify` | `rsend-apne1.forge.rmta.net` | **必须保留** |
| CNAME | `www` | `fantasticumbrella.com` | 保留，或绑 Pages 后 301 到裸域 |
| CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com` | GoDaddy 专用，可留可删 |
| TXT | `_acme-challenge.www` | `ElTHvglaXndDgJXgOR2pwDFCiKXxuCHM5_rQScV7zX0` | 保留 |
| TXT | `_cf-custom-hostname.www` | `6bc8ecb5-950b-41a7-be38-d6387cf447d4` | 保留 |
| A | `@` | `160.153.0.130`（GoDaddy WP） | 由 Cloudflare 的 apex CNAME flattening 取代 |
| NS | `@` | `ns29 / ns30.domaincontrol.com` | **最后一步**改成 Cloudflare 分配的两个 NS |

### 两条路径

| | A：整体迁 NS（推荐） | B：只切 www，DNS 留 GoDaddy |
| --- | --- | --- |
| 正式网址 | `https://fantasticumbrella.com/`（裸域，canonical 已是这个） | `https://www.fantasticumbrella.com/`，裸域靠 GoDaddy 转发 301 |
| 操作 | Cloudflare Add a site → 逐条核对上表 → Pages 绑裸域 + www → GoDaddy 改 2 个 NS | Pages 绑 `www` → GoDaddy 给 `www` 加 CNAME 到 `*.pages.dev` → 裸域用域名转发跳到 www |
| 风险 | NS 切换当天若漏一条邮件记录会退信，须先核对再切 | 不动 NS，邮箱零风险；但正式域名带 www，canonical/sitemap 要统一改 |
| 收益 | 裸域直连静态站、SSL 自动、CDN/WAF、CNAME flattening、SEO 最干净 | 改动最小、回退最快 |

**切换顺序（A）**：① Cloudflare 加 zone（自动扫描 DNS）→ ② 逐条核对上表并补齐漏项 → ③ Pages → Custom domains → 添加裸域与 www → ④ 证书 Active → ⑤ **最后**才去 GoDaddy 改 NS → ⑥ 等 5–30 分钟生效并验收。**顺序反了邮件会先断。**

### 切流后验收清单

- `https://fantasticumbrella.com/` 返回 Astro 首页（不再是 WP），HTTPS 有效；`www` 301 到裸域或同等内容。
- 主域 `/robots.txt` 返回 `Allow: /` + Sitemap；预览域名仍是 `Disallow: /`。
- 随机开 3 个产品页，图片都是本站 `/images/products/...` 且 200。
- `/contact/` 提交一封真实询盘，Zoho `sales@` 收到（新发信域首批可能有 10–15 分钟延迟）。
- 外部邮箱发一封到 `sales@` 确认 MX 仍通；Gmail「显示原始邮件」仍 `spf=pass` / `dkim=pass` / `dmarc=pass`。

### 切流完成实测（2026-11-15 18:12–18:25）

用户在 GoDaddy 把 NS 改成 `adi.ns.cloudflare.com` / `damiete.ns.cloudflare.com` 后，公网 NS 与 SOA 随即切到 Cloudflare（`8.8.8.8` 实测），zone 由 `pending` 变 `active`。

**过渡期两个真实问题与修复**（由 `cf-admin.yml` + `scripts/cf-zone-setup.py` 新增的 `activate` / `purge` action 处理）：

1. Cloudflare 没有自动生成 apex / www 的网站记录，`GET /domains/{name}` 返回 `verification_data.error_message = "CNAME record not set"`。已补两条 `proxied=True` 的 CNAME 指向 `fantastic-umbrella-e13.pages.dev`。**注意**：项目 API 的 `subdomain` 已经是完整 `*.pages.dev`，不要再拼一次后缀 —— 首版脚本曾误写成 `.pages.dev.pages.dev`，已用 `PUT` 原地修正。
2. 改 NS 后主域一度仍返回旧 WordPress 页面，响应头 `CF-Cache-Status: HIT` / `Age: ~96000` / `x-gateway-cache-*` / `Link: wp-json`，是 GoDaddy Managed WordPress 自带 Cloudflare CDN 留下的旧缓存；`/.well-known/acme-challenge/*` 返回 500，导致 apex 自定义域一度 `deactivated`、HTTP DCV 失败。执行 `purge_everything` + 重新 `PATCH` retry validation 后，两个域名 `verification=active`，证书签发完成，主域自动切到 Astro。

**最终状态**：zone `active`；apex 自定义域 `active`、www `pending`（状态滞后，实际 HTTPS 与内容均正常）；DNS 16 条 = 14 条邮件/验证记录 + 2 条 proxied CNAME。

**验收实测**：

- `https://fantasticumbrella.com/` 200 + 有效证书（`ssl_verify_result=0`），首页 Astro（6 处 `/images/products/`，无 `wp-content`）。
- 主域 `/robots.txt` 返回 `# served-by: pages-function` + `Allow: /` + Sitemap；预览域名仍 `Disallow: /`。
- `/sitemap.xml` 200 XML；产品图 `200 image/jpeg 417901`；`/contact/`、`/products/` 均 200。
- `/api/enquiry` GET → `email=true, mode=verified-domain, to=sales@fantasticumbrella.com`；POST 真实自检询盘 → `200 ok`，Resend 邮件 id `01a1debd-0e03-733d-8a60-830c895536cd`，`from=no-reply@notify.fantasticumbrella.com`。
- 301 实测：`/shop/ → /products/`、`/track-order/ → /contact/`、已下线产品 → `/products/` 均 301。
- 从 Cloudflare 权威 NS 直查：MX ×3、主域 SPF、zoho-verification、`_dmarc`、Zoho DKIM、SPF include、Resend DKIM、`send/rsend` CNAME 全部正确，**邮件未断**。
- `www` 返回 200 且证书有效、内容与裸域相同（canonical 指向裸域），目前**未做 301**；若要统一权重，可在 Cloudflare 加一条 Redirect Rule 把 `www` 跳到裸域。

**回退**：把 GoDaddy NS 改回 `ns29 / ns30.domaincontrol.com`（GoDaddy 里的 A / MX / TXT 一直保留未删）。**GoDaddy Managed WordPress 订阅先别取消**，观察几天再决定。
- 旧 WP URL 的 301（`public/_redirects` 19 条）；`/shop/`、`/my-account/` 等电商页会 404，需要则补 301。
- GoDaddy Managed WordPress 订阅在确认无需回退后再取消（**先备份 WP 数据**）。

### 浏览器仍显示旧 WordPress 页面（2026-11-15 18:30 排查与加固）

**结论：服务端已完全切干净，旧页面只可能来自访客浏览器本地。**

| 检查 | 结果 |
| --- | --- |
| 带代理 / 直连 curl 主域 | 均返回 Astro 首页；`cf-cache-status: DYNAMIC`、`Cache-Control: public, max-age=0, must-revalidate`，无 `Age` 头 |
| 连续 5 次不同 URL 探测 | 5/5 全是新站（6 处 `/images/products/`、标题 `Custom Compact Umbrella Manufacturer`），无 `wp-content` |
| 独立第三方出口抓取 | 标题与正文均为新 B2B 首页，无 WP 特征 |
| 本机解析 | `A 104.21.30.68 / 172.67.172.56`（Cloudflare），hosts 无条目；已执行 `ipconfig /flushdns` 后复核 |

**成因**：旧 WP 响应若带较长 `max-age`，浏览器会直接用本地缓存副本而不发请求，服务端换新头也清不掉；更麻烦的是旧站若注册过 Service Worker（scope `/`），切流后 `/sw.js` 曾返回 `200 text/html`（软 404），浏览器拿不到合法 JS 就**永远无法更新该 worker**，它会持续吐缓存的 WP 页面 —— 普通刷新也无效。

**服务端加固**（远程 `488770fc`，Actions `43704765305` 全绿）：

- `public/sw.js`：迁移期 kill-switch。浏览器更新检查拉到合法 JS 后清空本 origin 全部 Cache Storage 并自注销；`fetch` 事件一律直连网络，不再读缓存。
- `src/layouts/Base.astro`：所有页面内联一次性清理脚本，访客只要拿到任意一张真实新页面，就注销残留 SW 并清 Cache Storage（origin 隔离，不影响其它站点）。**临时代码，2026-12-31 后可删**。
- `public/404.html`：修复软 404。此前 `/wp-admin/`、`/sw.js`、`/wp-json/` 等旧 WP 路径都返回 `200 text/html` 首页，会被搜索引擎当成重复页；现在返回 `404` + `noindex`。实测 `/wp-admin/` → 404，`/sw.js` → `200 application/javascript`，首页含清理脚本且仍为 Astro，`robots.txt` 仍 `Allow: /`，`/api/enquiry` 仍 `verified-domain`。

**访客侧必须自己做一次**（浏览器本地缓存，服务端无法代清）：

1. 最快验证：开**无痕窗口**打开 `https://fantasticumbrella.com/?fresh=1` —— 看到新站即证明是本地缓存。
2. 普通窗口按 `Ctrl + Shift + R`（强制刷新）一到两次。
3. 仍旧：F12 → Application → Service Workers → Unregister；Storage → Clear site data，再刷新；或在浏览器设置里删除 `fantasticumbrella.com` 的站点数据。
4. 若手机 / 其它网络仍是旧站，是那侧 DNS 缓存了 GoDaddy 的旧 A `160.153.0.130`，等 TTL（约 1 小时）过期或切飞行模式重连。
5. 若指的是 **Google / Bing 搜索结果里的旧标题与摘要**，那是搜索索引缓存，与站点切换无关；等重新抓取，或在 Search Console 提交 `sitemap.xml` 加速更新。

---

## 11. 多语言（2026-11-16 全站上线）

按用户确认的范围一次到位：**英文 + 西班牙语 + 法语 + 德语，全站 19 个页面 × 4 语种 = 76 页**。详细交付与维护手册见上级目录 `fantasticumbrella_多语言上线与维护_2026-11-16.md`。

### URL 策略

| 语种 | 首页 | 正文页 | 产品 |
| --- | --- | --- | --- |
| en（默认） | `/` | `/contact/` | `/product/<slug>/` |
| es | `/es/` | `/es/contact/` | `/es/product/<slug>/` |
| fr | `/fr/` | `/fr/contact/` | `/fr/product/<slug>/` |
| de | `/de/` | `/de/contact/` | `/de/product/<slug>/` |

英文**保持原有无前缀 URL**，因此 19 条旧 WP 301、已有外链与英文页排名零损伤。**路径 slug 不翻译**（`contact`、`products`、`product/<slug>` 四语种一致），保证 hreflang 一一对应、canonical 规则简单、下游脚本不需改。

**语言切换器是页头的一个下拉单**（2026-11-16 改版）：收起时显示地球图标 + 当前语种代码（EN / ES / FR / DE），展开后列出四个本地语言名称（English / Español / Français / Deutsch），当前项高亮打勾。用原生 `<details>` / `<summary>` 实现，**不依赖 JS 也能开合**；四个 `<a>` 始终保留在 HTML 里并带 `lang` / `hreflang` / `rel="alternate"`，搜索引擎仍可抓取语种关系。`Header.astro` 末尾有一段 `is:inline` 渐进增强脚本，仅用于点击外部或按 Esc 关闭菜单。切换后停留在当前页的对应语种，不会跳回首页。

### 文件职责

| 路径 | 作用 |
| --- | --- |
| `src/i18n/config.mjs` | 语种列表、前缀与路径换算、`alternates()` 生成 hreflang 组 |
| `src/i18n/ui/{en,es,fr,de}.json` | 导航、页脚、按钮、表单标签等 **122 个 UI 键** |
| `src/i18n/pages/{en,es,fr,de}.json` | 5 个正文页的 **246 个可见文本节点**（按文档顺序） |
| `src/i18n/products/{en,es,fr,de}.json` | 12 款产品的名称与简介 |
| `src/i18n/html.mjs` | 按 `>([^<]+)<` 替换可见文本节点；标签、属性、class、实体编码保持字节一致；译文短/缺时剩余节点保留英文而非破坏结构；并给正文内部链接加语种前缀 |
| `src/i18n/dict.mjs` / `routes.mjs` | 词典读取；`getStaticPaths` 载荷（用静态 JSON import，避免打包后 `import.meta.url` 指向 `dist/` 而读不到文件） |
| `src/components/pages/*` | 共享页面组件，接收 `locale`；`src/pages/**` 各路由只是三行薄壳 |
| `scripts/extract-page-texts.mjs` | 从英文正文重新抽取待译文本节点 |
| `scripts/verify-i18n.mjs` | 校验 UI 键结构、占位符、正文节点数、产品 slug 集合；**prebuild 必跑，失败即阻断构建** |
| `scripts/make-sitemap.mjs` | 生成 76 条 URL，每条带 4 语种 + `x-default` 的 reciprocal hreflang |
| `scripts/guard-legacy-sync.mjs` | 冻结旧 `sync-content` / `rebuild-scope`，防止覆盖多语言成果 |

### SEO 与表单

- 每个页面 `<html lang>` 正确，输出 4 条 `hreflang` + 1 条 `x-default`，canonical **自指**（不是一律指英文页）。
- `public/sitemap.xml` 由 `make-sitemap.mjs` 在 prebuild 生成，CI 断言 76 条 URL；`functions/robots.txt.ts` 仍按 host 区分主域 `Allow` / 预览域名 `Disallow`。
- `EnquiryForm.astro` 全部可见文案走词典，提交带隐藏字段 `_locale`；**表单 action 仍是 `/api/enquiry`，不加语种前缀**。`functions/api/enquiry.ts` 按 `_locale` 返回对应语种的提示语，邮件标题加 `[ES]` / `[FR]` / `[DE]` 前缀并标注来源语言，未知值回落英文。
- 246 个正文节点中 **240 个已译（98%）**，剩余 6 个是邮箱、电话与纯符号，有意保留不改。

### 维护流程

1. 改英文正文或产品文案 → 改 `src/data/*.json`（**不要跑 `npm run sync`**）。
2. 若正文结构变化 → `node scripts/extract-page-texts.mjs` 重抽文本节点，补齐 `src/i18n/pages/{es,fr,de}.json` 对应条目（节点顺序与数量必须一致）。
3. 改 UI 文案 → 四个 `src/i18n/ui/*.json` 同步加键；含 `{count}` 等占位符的译文必须原样保留。
4. `npm run verify:i18n && npm run build` → 确认 76 页 / 76 sitemap URL。
5. push `main`，GitHub Actions 自动部署并自检；上线后抽查各语种首页、正文页、产品页与表单。
6. 新增语种：在 `config.mjs` 的 `LOCALES` / `LOCALE_NAMES` / `LOCALE_MAIL_TAGS` 登记 → 补四份词典 → 复制一份 `src/pages/es/` 薄壳目录改 locale → 更新 CI 里的页面数断言（当前 76 = 19 × 4）。

### 上线验收实测（2026-11-16）

push `main` → 远程 `7cf05f0`，Actions run `43791676708` **success**，Pages 自动部署完成。线上逐项实测：

- 主域 `/sitemap.xml` 200、**76 条 `<loc>`**，逐个 curl 验证 **76/76 全为 200**（19 条路径 × 4 语种），含 es/fr/de 与 hreflang alternates。
- `/es/`、`/fr/`、`/de/` 首页均 200，`<html lang>` 正确，各含 4 条 `hreflang` + `x-default`，canonical 自指，产品图为本地 `/images/products/` 且无 `wp-content`；三语种正文与英文不同。
- 译文抽查：西/法/德 `contact` 页 UI 文案命中本地词典译文，`golf-umbrella` 详情页产品名分别为 `Paraguas de golf con mango de madera` / `Parapluie golf à manche en bois` / `Golfschirm mit Holzgriff`。
- 语言切换器在 `/es/contact/` 正确映射到同页的 en/es/fr/de 四个 URL；表单 `_locale` 分别为 `es`/`fr`/`de`/`en`，action 仍为 `/api/enquiry`。
- 零回归：英文首页内容不变；主域 robots `Allow` / 预览域名 `Disallow`；`/api/enquiry` 仍 `verified-domain → sales@fantasticumbrella.com`；`/sw.js` 为合法 JS；`/wp-admin/` 404；`/shop/` 301。
- **注意**：站点没有 `/about/` 页，5 个正文页 slug 为 `contact`、`faqs`、`quality-claims`、`services`、`shipping-delivery`（写验收脚本时别猜 slug，从 sitemap 取）。

### 已知边界

- 译文为一次性批量生成，**建议由母语者抽校产品名、规格术语与询盘表单提示**，尤其是德语复合词与法语长句可能撑破按钮布局。
- URL slug 不翻译（西/法/德产品 URL 仍是英文 slug），是刻意的稳定性取舍，不是遗漏。
- `www` 仍未 301 到裸域；DMARC 仍 `p=none`；GoDaddy 托管订阅未取消 —— 均为第 10 节遗留的可选项，与多语言无关。
- 迁移期 Service Worker 清理脚本（`Base.astro` 内联）计划 2026-12-31 后删除，四语种页面都带该脚本。

---

## 12. 社媒链接与分享标签（2026-11-16）

### 配置源

**`src/data/social.json` 是唯一的社媒配置源**。数组里每一项的 `href` 填上官方主页 URL 后，会自动出现在四语种页脚的「Follow us / Síguenos / Suivez-nous / Folgen Sie uns」徽章区，并自动写进 Organization schema 的 `sameAs`；空 `href` 不渲染任何东西。链接统一 `target="_blank" rel="noopener noreferrer"`，`aria-label` 用四语种词典 `footer.followOn`（含 `{name}` 占位符）。

当前只配置了**已确认存在**的两个渠道：

| 渠道 | 来源 | 状态 |
| --- | --- | --- |
| 邮箱 `sales@fantasticumbrella.com` | Contact 页 / 表单收件人 | `mailto:` 链接 |
| WhatsApp `+86 137 2520 9358` | Contact 页「Phone / WhatsApp」 | `https://wa.me/8613725209358` 直链 + WA 徽章 |

`Facebook` / `Instagram` / `LinkedIn` / `YouTube` / `Pinterest` / `TikTok` / `X` 预留了条目但 `href` 为空。**不要凭搜索结果填**：品牌名与 1968 年罗德岛同名景点冲突（见 `Base.astro` 的实体消歧注释），搜到的账号很可能不是本公司的。拿到用户确认的官方主页 URL 后，只改这个 JSON → `npm run build` → push 即可，无需改组件。

### 分享标签与结构化数据

`Base.astro` 全站输出：`og:site_name`、`og:image`（指向本地 `/images/products/fan-spray-umbrella.jpg`）、`og:image:alt`、`twitter:card=summary_large_image`、`twitter:title/description/image`；Organization JSON-LD 增加 `contactPoint`（sales 邮箱、电话、`availableLanguage: en/es/fr/de`），`sameAs` 只在配置了社媒主页时出现。

**注意**：旧 WordPress 站审计明确记录**没有装 GA4 / GTM / gtag / 任何社媒像素**，本地备份、页脚 widget 备份与 DNS TXT 里也都没有社媒主页或域名验证记录，所以这里没有「可转移」的追踪标签。若需要 Meta Pixel / LinkedIn Insight Tag / TikTok Pixel / GA4，需提供对应 ID，且会引入第三方脚本（性能与隐私影响需单独确认），不属于本次静态迁移范围。

---

**关联文档**（位于上级工作目录）：`fantasticumbrella_Astro迁移评估_2026-11-12.md`、`fantasticumbrella_Astro迁移执行流程_2026-11-13.md`、`fantasticumbrella_产品线范围与两站分工_2026-11-13.md`、`fantasticumbrella_去WP决策与托管实测_2026-11-14.md`、`fantasticumbrella_多语言上线与维护_2026-11-16.md`。
