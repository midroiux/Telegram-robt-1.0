import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { RuntimeContext } from "@mastra/core/di";
import {
  addIncomeRecord,
  addOutgoingRecord,
  deleteAllRecords,
} from "../tools/transactionTools";
import { showAllBills } from "../tools/queryTools";

/**
 * Accounting Workflow for Telegram Bot
 * 
 * 极速版本：使用直接命令匹配，无需AI调用，响应时间2-3秒
 */

/**
 * Step 1: 直接匹配命令并执行
 * 使用正则表达式快速匹配，直接调用工具
 */
const processAccountingMessage = createStep({
  id: "process-accounting-message",
  description: "直接匹配命令并执行记账操作（无AI调用）",
  
  inputSchema: z.object({
    userName: z.string().describe("Telegram 用户名"),
    message: z.string().describe("用户发送的消息"),
    userId: z.string().describe("用户 ID"),
    chatId: z.number().describe("Telegram chat ID"),
  }),
  
  outputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
    userName: z.string(),
    chatId: z.number(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("⚡ [FastMatch] 快速匹配命令", {
      userName: inputData.userName,
      message: inputData.message,
    });
    
    const runtimeContext = new RuntimeContext();
    
    try {
      const msg = inputData.message.trim();
      const groupId = "-4948354487"; // 固定群组ID
      
      // 匹配 +数字 (入款)
      const incomeMatch = msg.match(/^\+(\d+(?:\.\d+)?)(\$)?$/);
      if (incomeMatch) {
        const amount = parseFloat(incomeMatch[1]);
        const currency = incomeMatch[2] ? "USD" : "THB";
        
        logger?.info("✅ [FastMatch] 匹配到入款命令", { amount, currency });
        
        // 执行入款
        const incomeResult = await addIncomeRecord.execute({
          context: {
            groupId,
            userId: inputData.userId,
            username: inputData.userName,
            amount,
            currency,
            messageId: "",
          },
          runtimeContext,
        });
        
        // 显示账单
        const billsResult = await showAllBills.execute({
          context: { groupId, showAll: false },
          runtimeContext,
        });
        
        return {
          response: `✅ 入款成功: ${currency === "USD" ? "$" : "฿"}${amount}\n\n${billsResult.message}`,
          success: true,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 匹配 -数字 (出款)
      const outgoingMatch = msg.match(/^-(\d+(?:\.\d+)?)(\$)?$/);
      if (outgoingMatch) {
        const amount = parseFloat(outgoingMatch[1]);
        const currency = outgoingMatch[2] ? "USD" : "THB";
        
        logger?.info("✅ [FastMatch] 匹配到出款命令", { amount, currency });
        
        // 执行出款
        const outgoingResult = await addOutgoingRecord.execute({
          context: {
            groupId,
            userId: inputData.userId,
            username: inputData.userName,
            amount,
            currency,
            messageId: "",
          },
          runtimeContext,
        });
        
        // 显示账单
        const billsResult = await showAllBills.execute({
          context: { groupId, showAll: false },
          runtimeContext,
        });
        
        return {
          response: `✅ 出款成功: ${currency === "USD" ? "$" : "฿"}${amount}\n\n${billsResult.message}`,
          success: true,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 匹配 总账
      if (msg === "总账" || msg === "账单" || msg === "查询") {
        logger?.info("✅ [FastMatch] 匹配到查询命令");
        
        const billsResult = await showAllBills.execute({
          context: { groupId, showAll: false },
          runtimeContext,
        });
        
        return {
          response: billsResult.message,
          success: true,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 匹配 结算
      if (msg === "结算" || msg === "全部" || msg === "完整账单") {
        logger?.info("✅ [FastMatch] 匹配到结算命令");
        
        const billsResult = await showAllBills.execute({
          context: { groupId, showAll: true },
          runtimeContext,
        });
        
        return {
          response: `📊 结算报告：\n\n${billsResult.message}`,
          success: true,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 匹配 删除所有账单
      if (msg.includes("删除") && msg.includes("账单")) {
        logger?.info("✅ [FastMatch] 匹配到删除命令");
        
        const deleteResult = await deleteAllRecords.execute({
          context: { groupId },
          runtimeContext,
        });
        
        return {
          response: deleteResult.message,
          success: true,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 未匹配到命令
      logger?.info("❓ [FastMatch] 未识别的命令");
      return {
        response: "命令格式：\n+数字 (入款)\n-数字 (出款)\n总账 (查询)\n结算 (完整账单)\n删除所有账单",
        success: false,
        userName: inputData.userName,
        chatId: inputData.chatId,
      };
      
    } catch (error: any) {
      logger?.error("❌ [FastMatch] 处理失败", {
        error: error.message,
      });
      
      return {
        response: `❌ 处理失败: ${error.message}`,
        success: false,
        userName: inputData.userName,
        chatId: inputData.chatId,
      };
    }
  },
});

/**
 * Step 2: Send Response to Telegram
 * Sends the agent's response back to the user via Telegram
 */
const sendTelegramResponse = createStep({
  id: "send-telegram-response",
  description: "将 Agent 的响应发送回 Telegram 用户",
  
  inputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
    userName: z.string(),
    chatId: z.number(),
  }),
  
  outputSchema: z.object({
    sent: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [SendTelegramResponse] 开始发送Telegram消息", {
      userName: inputData.userName,
      chatId: inputData.chatId,
      responseLength: inputData.response.length,
    });
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      logger?.error("❌ TELEGRAM_BOT_TOKEN 未设置");
      return {
        sent: false,
        message: inputData.response,
      };
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: inputData.chatId,
            text: inputData.response,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger?.error("❌ [SendTelegramResponse] 发送失败", { error: errorText });
        return {
          sent: false,
          message: inputData.response,
        };
      }

      logger?.info("✅ [SendTelegramResponse] 消息发送成功");
      
      return {
        sent: true,
        message: inputData.response,
      };
    } catch (error: any) {
      logger?.error("❌ [SendTelegramResponse] 发送异常", { error: error.message });
      return {
        sent: false,
        message: inputData.response,
      };
    }
  },
});

/**
 * Create the Accounting Workflow
 * Chains the steps together to create a complete workflow
 */
export const accountingWorkflow = createWorkflow({
  id: "accounting-workflow",
  
  inputSchema: z.object({
    userName: z.string(),
    message: z.string(),
    userId: z.string(),
    chatId: z.number(),
  }),
  
  outputSchema: z.object({
    sent: z.boolean(),
    message: z.string(),
  }),
})
  .then(processAccountingMessage)
  .then(sendTelegramResponse)
  .commit();
