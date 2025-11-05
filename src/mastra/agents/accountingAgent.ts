import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import {
  addIncomeRecord,
  addOutgoingRecord,
  deleteAllRecords,
} from "../tools/transactionTools";
import {
  showAllBills,
  dailySettlement,
} from "../tools/queryTools";
import {
  setIncomeFeeRate,
  setOutgoingFeeRate,
} from "../tools/rateTools";

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
  name: "极简记账助手",
  
  instructions: `极简记账机器人。快速处理命令。

**命令:**
+数字 → 入款, 调用addIncomeRecord然后showAllBills(showAll=false)
-数字 → 出款, 调用addOutgoingRecord然后showAllBills(showAll=false)
总账 → 调用showAllBills(showAll=false)
日结算 → 调用dailySettlement 执行今日结算并标记账单
删除所有账单 → 调用deleteAllRecords
入款费率X → 调用setIncomeFeeRate设置入款费率为X%
下发费率X → 调用setOutgoingFeeRate设置下发费率为X%

**规则:**
1. 默认币种THB，有$符号用USD
2. 入款/出款后立即调用showAllBills显示账单（默认显示前3笔）
3. 快速提取数字直接调用工具

**示例:**
+1000 → addIncomeRecord(1000,THB) + showAllBills(showAll=false)
-500 → addOutgoingRecord(500,THB) + showAllBills(showAll=false)
总账 → showAllBills(showAll=false)
日结算 → dailySettlement
入款费率6 → setIncomeFeeRate(6)
下发费率0 → setOutgoingFeeRate(0)
`,

  model: openai("gpt-4o-mini"),
  
  tools: {
    addIncomeRecord,
    addOutgoingRecord,
    deleteAllRecords,
    showAllBills,
    dailySettlement,
    setIncomeFeeRate,
    setOutgoingFeeRate,
  },
});
