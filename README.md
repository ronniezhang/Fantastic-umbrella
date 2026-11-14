# fantasticumbrella.com — Astro 静态前台

B2B 站点迁移用的 Astro 源码仓库。**线上主域名目前仍是 WordPress（GoDaddy Managed WordPress）**；静态站已在 Cloudflare Pages 预览域名运行（GitHub Actions 自动构建发布），但**尚未切流、未绑定主域名**。

日期：2026-11-14

---

## 1. 当前状态

| 项 | 值 |
| --- | --- |
| 静态页 | 19（首页 + 5 个 B2B 页 + 产品列表 + 12 个产品页） |
| 构建产物 | `dist/` 约 193 KB，零运行时脚本 |
| 产品范围 | 手持小伞 8 款主推、沙滩伞 4 款附带；14 款沙滩椅/天幕/庭院伞移出至 GreenMark |
| 范围规则 | `src/data/catalog-scope.json`（唯一事实源，`npm run sync` 会读取它） |
| 询盘表单 | Astro 原生渲染，POST 到同源 Pages Function `/api/enquiry`；**投递通道由环境变量决定，未配置前明确报 503，不会静默丢单**。详见第 8 节 |
| 图片 | 12 个 `https://fantasticumbrella.com/wp-content/...` 绝对外链，仍依赖线上 WP |
| 301 | `public/_redirects`（Cloudflare Pages 格式）+ `dist/.htaccess`（Apache 格式），各 19 条 |
| SEO | canonical / description / Organization JSON-LD 全站覆盖；7 组 Title/Meta 在 `src/data/seo.json` |
| 预览地址 | **https://fantastic-umbrella-e13.pages.dev/**（Cloudflare Pages）；备用临时链接 `https://wbapp-72hb4123vtqk7gaufcq75x.app.workbuddy.host/?sharecode=4IFW5XU2RU` |
| 自动部署 | GitHub Actions `deploy-pages.yml`：push `main` 或 `workflow_dispatch` → `npm ci → npm run build → wrangler pages deploy dist --project-name=fantastic-umbrella` |

**注意**：`astro.config.mjs` 里 `site` 仍写主域名，因此 canonical 与 sitemap 都指向 `fantasticumbrella.com`。预览阶段这是有意的（避免预览站被当作正式站点收录），切流后无需改动。

---

## 2. 目录结构

```
astro-prototype/
├── astro.config.mjs          # build.format: 'directory'（保住尾斜杠 URL，勿改）
├── package.json
├── public/
│   ├── _redirects            # 19 条 301（Cloudflare Pages）
│   ├── sitemap.xml           # 19 条 URL
│   └── robots.txt            # 正式版：Allow / + Sitemap
├── scripts/
│   ├── sync-content.mjs      # 从线上 wp-json 拉内容（⚠ 见下方警告）
│   ├── catalog-scope.mjs     # 产品范围判定 + 正文术语修正
│   ├── rebuild-scope.mjs     # 离线重算目录（不联网、不撞后台限流）
│   ├── make-htaccess.mjs     # _redirects → Apache RewriteRule
│   └── make-preview.mjs      # 生成预览部署副本
├── src/
│   ├── data/                 # 内容数据（去 WP 后的唯一内容源，必须入库）
│   ├── layouts/Base.astro
│   ├── components/           # Header / Footer / EnquiryForm
│   ├── pages/                # index / [slug] / products / product/[slug]
│   └── styles/global.css
└── dist/                     # 构建产物（gitignore）
```

---

## 3. 常用命令

```bash
npm ci
npm run build          # → dist/，postbuild 自动再生成 dist/.htaccess
npm run preview        # 本地预览 http://127.0.0.1:4321/
npm run preview:stage  # → ../astro-preview/（纯静态部署副本）
```

> ⚠️ **`npm run sync` 会覆盖** `src/data/*.json`、`public/_redirects`、`public/sitemap.xml`、`public/robots.txt`，以及人工写进 `seo.json` 的描述。人工改动要么固化进脚本，要么在冻结期停跑 sync。WP 下线后 `wp-json` 停供，此命令将彻底不可用——`src/data/` 就是最终内容源。

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

### 环境变量（Pages 项目 → Settings → Environment variables，Production + Preview 都要填）

| 变量 | 用途 | 是否必填 |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend 的 API key（`re_...`），勾 Encrypt | 走邮件时必填 |
| `ENQUIRY_TO` | 收件人，多个用逗号分隔 | 走邮件时必填 |
| `ENQUIRY_FROM` | 发件人，如 `Fantastic Umbrella <sales@fantasticumbrella.com>` | 可选，默认 `onboarding@resend.dev` |
| `ENQUIRY_WEBHOOK_URL` | 企业微信 / 飞书 / Slack / 自建接口 URL，自动识别格式 | 可选 |
| `ENQUIRY_FORWARD_URL` | 第三方表单服务接收地址 | 可选 |
| `ENQUIRY_FORWARD_FORMAT` | 设 `form` 时按 `x-www-form-urlencoded` 转发（Formsubmit 等需要），默认 JSON | 可选 |
| `PUBLIC_ENQUIRY_ENDPOINT` | **构建时**变量，改前端 POST 目标；默认 `/api/enquiry`，正常不用动 | 可选 |

改完环境变量要**重新部署一次**才生效（Pages 在部署时把变量绑定进版本）。

### 通道 A：发到邮箱（推荐，最像原来的 Fluent Forms）

1. 注册 [Resend](https://resend.com)（免费额度 100 封/天、3000 封/月），拿 `RESEND_API_KEY`。
2. 测试期可用默认 `onboarding@resend.dev`，但**只能发给 Resend 注册邮箱**；正式用必须在 Resend 加 `fantasticumbrella.com` 域名并按提示加几条 DNS 记录（只加发信验证的 TXT/CNAME，**不动 A 记录、不动 NS、不影响网站托管**）。
3. 填 `ENQUIRY_TO` = 真实收件邮箱（先核实 `sales@fantasticumbrella.com` 是否确实收得到信，见第 6 节第 5 条）。
4. 重新部署 → 在 Contact 页提交一封真实询盘 → 确认收到、确认「回复」按钮落到客户邮箱（端点已设 `reply_to`）。

### 通道 B：发到企业微信 / 飞书 / Slack 群（不用域名验证，最快）

在群里加一个机器人拿 webhook URL，填 `ENQUIRY_WEBHOOK_URL` 即可。端点按 URL 自动选格式：`qyapi.weixin.qq.com` → `msgtype:text`，`open.feishu.cn` → `msg_type:text`，`hooks.slack.com` → `{text}`，其他 → 原始 JSON。适合「询盘立刻有人看到」，但**收件箱里没有存档**，建议和通道 A 一起开。

### 通道 C：第三方表单服务（最省事，但客户资料过第三方）

Formspree / Getform：注册后拿表单 URL，填 `ENQUIRY_FORWARD_URL`（JSON 即可）。Formsubmit.co 之类需要表单编码的，再设 `ENQUIRY_FORWARD_FORMAT=form`。费用、留存与隐私条款需自行评估，B2B 客户公司名、邮箱、采购量会经过该服务。

### 自检

```bash
curl -s -X POST https://fantastic-umbrella-e13.pages.dev/api/enquiry \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Test","company":"Test Co","email":"test@example.com","country":"DE","product_interest":"Golf umbrella","estimated_quantity":"500 pcs","message":"Endpoint check","_form_time":0}'
```

未配置任何通道时返回 `503 {"ok":false,"error":"not_configured"}`；配置成功后返回 `200 {"ok":true}`。也可以用 `node ../test_enquiry_endpoint.mjs` 跑本地逻辑自测（上级工作目录，12 个用例）。

**兜底降级**：任何一种失败（503 未配置、502 投递全挂、404 端点不存在、访客断网）都会在表单下方显示原因，并附一个一键 `mailto:sales@fantasticumbrella.com` 链接，客户仍能联系到销售，不会只看到一句报错就离开。因此预览期即使还没填密钥，表单也不会静默吞掉线索。

**线上状态（2026-11-14 13:10）**：`functions/` 已被 Wrangler 自动打包随 `pages deploy` 上线，端点不是 404/405，实测 `POST /api/enquiry` 返回 JSON。CI 的「Verify enquiry endpoint is live」步骤要求响应必须含 `ok` 字段（防止 405/HTML fallback 假绿），run `43560263612` 全步骤 success。**当前唯一未完成的是填投递通道的环境变量**，未配置时提交会明确返回 503。

端点已内置的防护：同源 Origin 校验、蜜罐字段、`1.5s` 极速提交拦截、必填/邮箱/长度校验、`no-store`、请求不落第三方日志。若后续询盘量起来，再加 Cloudflare Turnstile（免费、无验证码打扰）与 D1 存档。

---

**关联文档**（位于上级工作目录）：`fantasticumbrella_Astro迁移评估_2026-11-12.md`、`fantasticumbrella_Astro迁移执行流程_2026-11-13.md`、`fantasticumbrella_产品线范围与两站分工_2026-11-13.md`、`fantasticumbrella_去WP决策与托管实测_2026-11-14.md`。
