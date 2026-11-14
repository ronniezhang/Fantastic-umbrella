# fantasticumbrella.com — Astro 静态前台

B2B 站点迁移用的 Astro 源码仓库。**线上主域名目前仍是 WordPress（GoDaddy Managed WordPress）**，本仓库只负责生成静态站，尚未切流，也未绑定主域名。

日期：2026-11-14

---

## 1. 当前状态

| 项 | 值 |
| --- | --- |
| 静态页 | 19（首页 + 5 个 B2B 页 + 产品列表 + 12 个产品页） |
| 构建产物 | `dist/` 约 193 KB，零运行时脚本 |
| 产品范围 | 手持小伞 8 款主推、沙滩伞 4 款附带；14 款沙滩椅/天幕/庭院伞移出至 GreenMark |
| 范围规则 | `src/data/catalog-scope.json`（唯一事实源，`npm run sync` 会读取它） |
| 询盘表单 | Astro 原生渲染，**提交端点未接通**；提交时明确提示「未发送数据」，不会静默丢单 |
| 图片 | 12 个 `https://fantasticumbrella.com/wp-content/...` 绝对外链，仍依赖线上 WP |
| 301 | `public/_redirects`（Cloudflare Pages 格式）+ `dist/.htaccess`（Apache 格式），各 19 条 |
| SEO | canonical / description / Organization JSON-LD 全站覆盖；7 组 Title/Meta 在 `src/data/seo.json` |
| 预览地址 | `https://wbapp-72hb4123vtqk7gaufcq75x.app.workbuddy.host/?sharecode=4IFW5XU2RU` |

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

1. Cloudflare 面板 → **My Profile → API Tokens → Create Token** → Custom Token → **Get started**
   - Token name：`pages-deploy-fantastic-umbrella`
   - Permissions：**Account / Cloudflare Pages / Edit**（官方 CI 文档指定的权限）
   - Continue to summary → Create Token → 复制 token（只显示一次）
2. GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**，加两个值：
   - `CLOUDFLARE_API_TOKEN` = 上一步的 token
   - `CLOUDFLARE_ACCOUNT_ID` = Cloudflare 面板首页 URL 里那串 32 位账号 ID
3. 告诉我「加好了」，我触发一次部署并逐页验收 `https://fantastic-umbrella.pages.dev`（项目名若被占用，Cloudflare 会自动加随机后缀，以实际 URL 为准）。

仓库已带 `.github/workflows/deploy-pages.yml`：push 到 `main` 即自动 `npm ci → npm run build → wrangler pages deploy dist`，之后改一句文案 `git push` 就发布。两个 Secret 未配置时 workflow 会安全跳过，不产生失败记录。

**取舍（重要）**：wrangler 部署创建的是 **Direct Upload** 项目，官方明确它之后**不能切换成 Git 集成**。若以后想要面板里原生的 GitHub 关联与 PR 预览部署，需删除并重建项目；`git push` 自动发布由 GitHub Actions 提供，不受影响。

**预览期 SEO**：workflow 在部署前把 `dist/robots.txt` 覆写为 `Disallow: /`，且全站 canonical 仍指向主域名，避免 `*.pages.dev` 被当成正式站收录。**切流绑主域名时必须删掉这一步**，恢复 `public/robots.txt`（含 sitemap）。

**不要做**：把 Cloudflare 主账号密码或 Global API Key 发出来；把 token 写进任何文件；在授权前点 **Add a custom domain**。

---

## 6. 切流前的硬门槛（未完成不得改 DNS）

1. 询盘表单接通非 WP 端点（Worker + 邮件 API / 第三方表单服务），并**发一封真实询盘确认邮箱收到**
2. 12 个 `wp-content` 图片本地化 + 中文文件名重命名
3. Yoast 的 meta description 从数据库导出（REST 不暴露该字段）
4. 3 个法务/关于页 + 9 个分类页补齐
5. 邮箱 `sales@fantasticumbrella.com` 归属核实（是否绑在 GoDaddy 主机套餐里）
6. 站点负责人明确授权后才动 GoDaddy DNS

---

## 7. 预览部署

预览站由 WorkBuddy 的临时发布链接提供，只用于验收视觉与内容，**不是生产托管**，不承接主域名流量。预览副本 `astro-preview/robots.txt` 为 `Disallow: /`，禁止收录。

预览地址：https://wbapp-72hb4123vtqk7gaufcq75x.app.workbuddy.host/?sharecode=4IFW5XU2RU

2026-11-14 实测：首页 200 / 9.4 KB / 首字节 0.33s，6 个 B2B 页与产品页均 200，robots 为 `Disallow: /`，canonical 仍指向主域名，图片经 `fantasticumbrella.com/wp-content/` 绝对地址可正常加载。此链接为临时预览，非生产托管；重新发布时会覆盖同一链接。

---

**关联文档**（位于上级工作目录）：`fantasticumbrella_Astro迁移评估_2026-11-12.md`、`fantasticumbrella_Astro迁移执行流程_2026-11-13.md`、`fantasticumbrella_产品线范围与两站分工_2026-11-13.md`、`fantasticumbrella_去WP决策与托管实测_2026-11-14.md`。
