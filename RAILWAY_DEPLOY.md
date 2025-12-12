# Railway 部署指南

## 步骤 1: 准备代码

1. 下载此项目的所有代码
2. 在 Replit 中点击左侧面板的 "..." 按钮
3. 选择 "Download as zip"

## 步骤 2: 创建 Railway 账号

1. 访问 https://railway.app
2. 使用 GitHub 账号登录（推荐）或创建新账号
3. Railway 提供每月 $5 免费额度

## 步骤 3: 部署到 Railway

### 方法 A: 从 GitHub 部署（推荐）

1. 将下载的代码上传到你的 GitHub 仓库
2. 在 Railway 控制台点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择你的仓库
5. Railway 会自动检测并部署

### 方法 B: 直接部署

1. 安装 Railway CLI: `npm install -g @railway/cli`
2. 登录: `railway login`
3. 在项目目录运行: `railway init`
4. 部署: `railway up`

## 步骤 4: 设置环境变量

在 Railway 控制台的 "Variables" 标签页添加以下变量：

```
TELEGRAM_BOT_TOKEN=你的机器人Token
GOOGLE_SHEETS_ID=你的Google表格ID
DATABASE_URL=你的PostgreSQL数据库URL（可以使用Railway的PostgreSQL插件）
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=你的OpenAI API Key
NODE_ENV=production
```

## 步骤 5: 添加 PostgreSQL 数据库

1. 在 Railway 项目中点击 "Add Service"
2. 选择 "PostgreSQL"
3. Railway 会自动设置 DATABASE_URL 环境变量

## 步骤 6: 更新 Telegram Webhook

部署完成后，你需要更新 Telegram webhook URL：

1. 获取你的 Railway 域名（格式: xxx.railway.app）
2. 在浏览器访问:
   ```
   https://api.telegram.org/bot你的TOKEN/setWebhook?url=https://你的域名.railway.app/api/telegram/webhook
   ```

或者使用 curl:
```bash
curl "https://api.telegram.org/bot你的TOKEN/setWebhook?url=https://你的域名.railway.app/api/telegram/webhook"
```

## 步骤 7: 验证部署

1. 访问 `https://你的域名.railway.app/api` 确认服务运行
2. 在 Telegram 群组发送 `z0` 测试机器人

## 重要提示

- Railway 的服务会**始终运行**，不会像 Replit Autoscale 那样自动关闭
- 免费额度用完后，Railway 会暂停服务，需要升级付费计划
- Railway 的 Hobby 计划是 $5/月，足够运行这个机器人

## 需要修改的代码

部署前，需要修改 `src/mastra/index.ts` 中的 webhook URL：

将第 230 行的:
```typescript
const PRODUCTION_WEBHOOK_URL = "https://tom-accounting-bot-tomchiachi.replit.app/api/telegram/webhook";
```

改为:
```typescript
const PRODUCTION_WEBHOOK_URL = process.env.WEBHOOK_URL || "https://你的域名.railway.app/api/telegram/webhook";
```

然后在 Railway 环境变量中设置:
```
WEBHOOK_URL=https://你的域名.railway.app/api/telegram/webhook
```
