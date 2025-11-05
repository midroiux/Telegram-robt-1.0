import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import {
  addOperator,
  removeOperator,
  checkUserPermission,
  listOperators,
} from "../tools/groupAccountingTools";
import {
  addIncomeRecord,
  addOutgoingRecord,
  revokeLastIncome,
  revokeLastOutgoing,
  deleteAllRecords,
} from "../tools/transactionTools";
import {
  setExchangeRate,
  setIncomeFeeRate,
  setOutgoingFeeRate,
  convertTHBtoUSD,
  getGroupSettings,
  showCurrentRates,
  setCutoffTime,
  setLanguage,
} from "../tools/rateTools";
import {
  showAllBills,
  showUserBills,
  showDetailedRecords,
} from "../tools/queryTools";

const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

/**
 * Payment Agency Accounting Agent for Telegram Bot
 * 
 * 支付代理记账机器人，支持泰铢/美元交易管理、汇率费率设置、日切结算等功能
 */

export const accountingAgent = new Agent({
  name: "代理记账助手",
  
  instructions: `你是支付代理记账机器人。快速识别命令并调用工具。

## 命令识别（快速匹配）

**入款:** +数字, 入款数字 → addIncomeRecord + showAllBills
**下发:** 下发数字, -数字 → addOutgoingRecord + showAllBills  
**撤销:** 撤销入款 → revokeLastIncome, 撤销下发 → revokeLastOutgoing
**汇率:** 设置汇率N → setExchangeRate, z0 → showCurrentRates, z数字 → convertTHBtoUSD
**费率:** 入款费率N → setIncomeFeeRate, 下发费率N → setOutgoingFeeRate
**查询:** 总账 → showAllBills, 我的账单 → showUserBills, 账单明细 → showDetailedRecords
**日切:** 日切#N → setCutoffTime
**语言:** 切换泰语 → setLanguage("泰语"), 切换中文 → setLanguage("中文")
**操作人:** 添加操作人 → addOperator, 删除操作人 → removeOperator, 查看操作人 → listOperators
**删除:** 删除所有账单 → deleteAllRecords

## 核心规则

1. **币种:** 默认THB，包含$用USD
2. **入款/下发后必须调用showAllBills显示完整账单**
3. 快速提取数字，立即调用工具
4. 用中文和emoji回复

## 示例

+1000 → addIncomeRecord(1000,THB) + showAllBills() → "✅入款成功：฿1000\n\n[完整账单]"
下发500$ → addOutgoingRecord(500,USD) + showAllBills() → "✅下发成功：$500\n\n[完整账单]"
总账 → showAllBills()
删除所有账单 → deleteAllRecords() → "✅已清空所有记录"
`,

  model: openai("gpt-4o-mini"),
  
  tools: {
    // 操作人管理
    addOperator,
    removeOperator,
    checkUserPermission,
    listOperators,
    // 交易记录
    addIncomeRecord,
    addOutgoingRecord,
    revokeLastIncome,
    revokeLastOutgoing,
    deleteAllRecords,
    // 汇率费率和日切
    setExchangeRate,
    setIncomeFeeRate,
    setOutgoingFeeRate,
    convertTHBtoUSD,
    getGroupSettings,
    showCurrentRates,
    setCutoffTime,
    setLanguage,
    // 账单查询
    showAllBills,
    showUserBills,
    showDetailedRecords,
  },
  
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: process.env.DATABASE_URL || "",
    }),
  }),
});
