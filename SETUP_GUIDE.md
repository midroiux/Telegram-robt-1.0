# Telegram 记账机器人 - 设置指南

这是一个功能完整的 Telegram 记账机器人,可以帮助你管理收支记录,所有数据自动同步到 Google Sheets。

## 功能特性

### 核心功能
- ✅ **记录收入** - 通过简单的消息记录收入
- ✅ **记录支出** - 快速记录各项支出
- ✅ **删除账单** - 删除错误的记录
- ✅ **汇率换算** - 支持多币种实时汇率查询和转换
- ✅ **费率设置** - 自定义收入和支出的费率
- ✅ **时间设置** - 自定义每日记账开始时间和结算时间
- ✅ **日汇总** - 查看每日收支汇总和净收入
- ✅ **数据持久化** - 所有数据自动保存到 Google Sheets

### 结算公式
当天总收入 = (总收入 - 收入费率) - (总支出 - 支出费率)

## 必需的环境变量

在 Replit Secrets 中设置以下变量:

### 1. Google Sheets 配置

**GOOGLE_SHEETS_CREDENTIALS**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**如何获取:**
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google Sheets API
4. 创建服务账号并下载 JSON 密钥
5. 将整个 JSON 内容复制到 GOOGLE_SHEETS_CREDENTIALS

**GOOGLE_SHEETS_ID**
- 这是你的 Google Sheets 文档 ID
- 从 Google Sheets URL 中获取: `https://docs.google.com/spreadsheets/d/{SHEETS_ID}/edit`
- 示例: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

**重要:** 记得将 Google Sheets 共享给服务账号的邮箱地址!

### 2. Telegram Bot Token

**TELEGRAM_BOT_TOKEN**
- 从 [@BotFather](https://t.me/botfather) 创建机器人获取
- 格式: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

### 3. 数据库 (已自动配置)
- `DATABASE_URL` - PostgreSQL 连接字符串 (Replit 自动提供)

## Google Sheets 表格结构

在你的 Google Sheets 中创建以下工作表:

### 1. "收入" 工作表
| 列 A (时间戳) | 列 B (类型) | 列 C (金额) | 列 D (币种) | 列 E (类别) | 列 F (描述) |
|--------------|------------|------------|------------|------------|------------|
| 2024-01-01 10:30:00 | 收入 | 1000 | CNY | 工资 | 月薪 |

### 2. "支出" 工作表
| 列 A (时间戳) | 列 B (类型) | 列 C (金额) | 列 D (币种) | 列 E (类别) | 列 F (描述) |
|--------------|------------|------------|------------|------------|------------|
| 2024-01-01 12:00:00 | 支出 | 50 | CNY | 餐饮 | 午餐 |

### 3. "设置" 工作表
| 列 A (设置项) | 列 B (值) |
|--------------|----------|
| 收入费率 | 0.05 |
| 支出费率 | 0.02 |
| 记账开始时间 | 00:00 |
| 结算时间 | 23:59 |

## 使用方法

### 基本命令

**记录收入:**
```
收入 500 美元,客户项目款
赚了 1000 人民币
进账 200 USD
```

**记录支出:**
```
支出 100 人民币,买书
花了 50 元吃饭
买了咖啡 30 CNY
```

**汇率查询:**
```
100 美元是多少人民币?
USD 到 CNY 的汇率
查询美元汇率
```

**查看汇总:**
```
今天收支情况
查看今日汇总
统计
```

**设置费率:**
```
设置收入费率 5%
设置支出费率 2%
```

**设置时间:**
```
设置结算时间 23:00
设置记账开始时间 00:00
```

**删除记录:**
```
删除收入记录 2024-01-01 10:30:00
删除最近一条支出
```

## 测试机器人

### 方法 1: 使用 Replit Playground
1. 点击 Replit 中的 "Playground" 标签
2. 在 Agent Chat 中测试各种命令
3. 查看机器人的响应和工具调用

### 方法 2: 在 Telegram 中测试
1. 确保所有环境变量已设置
2. 点击 "Publish" 发布你的应用
3. 设置 Telegram Webhook (发布后自动配置)
4. 在 Telegram 中向你的机器人发送消息

## 发布到生产环境

1. 确保所有环境变量正确配置
2. Google Sheets 已创建并共享给服务账号
3. 点击 Replit 的 "Publish" 按钮
4. 发布完成后,Telegram webhook 会自动激活
5. 在 Telegram 中开始使用你的记账机器人!

## 故障排除

### 机器人没有响应
- 检查 TELEGRAM_BOT_TOKEN 是否正确
- 确认 webhook 已正确设置
- 查看 Replit 日志了解错误信息

### Google Sheets 写入失败
- 确认 GOOGLE_SHEETS_CREDENTIALS 格式正确
- 验证 GOOGLE_SHEETS_ID 是否准确
- 确保工作表已共享给服务账号邮箱

### 汇率查询失败
- 检查网络连接
- 汇率 API 使用免费服务,可能有速率限制

## 技术架构

- **Framework**: Mastra (AI Agent Framework)
- **Trigger**: Telegram Webhook
- **Storage**: Google Sheets + PostgreSQL
- **LLM**: GPT-4o (通过 Replit AI Integrations)
- **Deployment**: Replit

## 进一步定制

你可以通过修改以下文件来定制机器人:

- `src/mastra/agents/accountingAgent.ts` - 修改机器人的行为和指令
- `src/mastra/tools/googleSheetsTool.ts` - 调整 Google Sheets 操作
- `src/mastra/tools/exchangeRateTool.ts` - 更换汇率 API
- `src/mastra/workflows/accountingWorkflow.ts` - 修改处理流程

## 支持

如有问题,请查看 Replit 日志或在 Playground 中测试各个组件。
