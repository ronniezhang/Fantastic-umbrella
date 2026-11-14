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

本地仓库已初始化并完成首次提交。**当前环境没有任何远程仓库、Git 凭据或 CLI**，因此代码尚未 push 到远端。拿到仓库后执行：

```bash
git remote add origin <仓库地址>
git push -u origin main
```

推送权限建议使用细粒度 PAT 或 SSH deploy key，不要用平台主账号密码。

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
