import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { accountingAgent } from "../agents/accountingAgent";

/**
 * Accounting Workflow for Telegram Bot
 * 
 * This workflow handles incoming Telegram messages and processes them
 * through the accounting agent to perform various accounting operations.
 */

/**
 * Step 1: Process Message with Accounting Agent
 * Takes the user's message and processes it using the accounting agent
 */
const processAccountingMessage = createStep({
  id: "process-accounting-message",
  description: "使用记账 Agent 处理用户消息,执行收支记录、查询、设置等操作",
  
  inputSchema: z.object({
    userName: z.string().describe("Telegram 用户名"),
    message: z.string().describe("用户发送的消息"),
    userId: z.string().describe("用户 ID,用于会话记忆"),
  }),
  
  outputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
    userName: z.string(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🚀 [ProcessAccountingMessage] 开始处理消息", {
      userName: inputData.userName,
      message: inputData.message,
    });
    
    try {
      // 使用 generateLegacy 方法调用 agent (必须用于 AI SDK v4)
      const result = await accountingAgent.generateLegacy(
        [
          {
            role: "user",
            content: inputData.message,
          },
        ],
        {
          resourceId: inputData.userId, // 用于会话记忆
          threadId: `telegram-${inputData.userId}`, // 线程 ID
          maxSteps: 10, // 允许多步工具调用
        }
      );
      
      logger?.info("✅ [ProcessAccountingMessage] Agent 处理完成", {
        response: result.text,
      });
      
      return {
        response: result.text,
        success: true,
        userName: inputData.userName,
      };
    } catch (error: any) {
      logger?.error("❌ [ProcessAccountingMessage] 处理失败", {
        error: error.message,
      });
      
      return {
        response: `抱歉,处理您的请求时出现错误: ${error.message}`,
        success: false,
        userName: inputData.userName,
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
  }),
  
  outputSchema: z.object({
    sent: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [SendTelegramResponse] 准备发送响应", {
      userName: inputData.userName,
      responseLength: inputData.response.length,
    });
    
    // 注意: Telegram 响应会通过返回值自动发送
    // 这一步主要用于日志记录和格式化
    
    logger?.info("✅ [SendTelegramResponse] 响应已准备完成");
    
    return {
      sent: true,
      message: inputData.response,
    };
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
  }),
  
  outputSchema: z.object({
    sent: z.boolean(),
    message: z.string(),
  }),
})
  .then(processAccountingMessage)
  .then(sendTelegramResponse)
  .commit();
