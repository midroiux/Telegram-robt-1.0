import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { RuntimeContext } from "@mastra/core/di";
import {
  addIncomeRecord,
  addOutgoingRecord,
  deleteAllRecords,
} from "../tools/transactionTools";
import { showAllBills, dailySettlement } from "../tools/queryTools";
import { setIncomeFeeRate, setOutgoingFeeRate } from "../tools/rateTools";
import { checkUserPermission } from "../tools/groupAccountingTools";

/**
 * Accounting Workflow for Telegram Bot
 * 
 * 极速版本：使用直接命令匹配，无需AI调用，响应时间2-3秒
 */

/**
 * 辅助函数：检查用户是否是Telegram群组管理员
 */
async function isGroupAdmin(chatId: number, userId: string, logger: any): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    logger?.error("❌ TELEGRAM_BOT_TOKEN 未设置");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`,
      { method: "GET" }
    );

    if (!response.ok) {
      logger?.error("❌ [IsGroupAdmin] Telegram API调用失败", {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }

    const data = await response.json();
    
    if (!data.ok) {
      logger?.error("❌ [IsGroupAdmin] Telegram API返回错误", { error: data });
      return false;
    }

    const status = data.result?.status;
    const isAdmin = status === "creator" || status === "administrator";
    
    logger?.info("✅ [IsGroupAdmin] 管理员检查完成", {
      userId,
      chatId,
      status,
      isAdmin,
    });
    
    return isAdmin;
  } catch (error: any) {
    logger?.error("❌ [IsGroupAdmin] 检查失败", { error: error.message });
    return false;
  }
}

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
    entities: z.array(z.any()).optional().describe("消息实体（用于解析@提及）"),
    replyToMessage: z.object({
      from: z.object({
        id: z.number(),
        username: z.string().optional(),
        first_name: z.string(),
      }),
    }).optional().describe("被回复的消息（用于权限管理）"),
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
      const groupId = inputData.chatId.toString(); // 动态获取群组ID，支持多群组
      
      // 匹配 我的ID (无需权限，让新用户也能查询)
      if (msg === "我的ID" || msg === "我的id" || msg === "/myid") {
        logger?.info("✅ [FastMatch] 匹配到查询ID命令");
        
        return {
          response: `👤 您的信息：\n用户名：${inputData.userName}\n用户ID：\`${inputData.userId}\`\n\n💡 请将此ID提供给管理员以获取操作权限`,
          success: true,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 🔑 权限管理命令 (需要验证管理员身份)
      // 方式1: 回复某人消息 + "添加权限"
      // 方式2: @某人 + "添加权限" (仅text_mention有效)
      if (msg.includes("添加权限") || msg.includes("添加操作人")) {
        logger?.info("🔑 [Permission] 检测到添加权限命令");
        
        // 🔒 验证管理员身份（动态检查Telegram群组管理员）
        const isAdmin = await isGroupAdmin(inputData.chatId, inputData.userId, logger);
        
        if (!isAdmin) {
          logger?.info("❌ [Permission] 非管理员尝试添加权限", {
            userId: inputData.userId,
            userName: inputData.userName,
          });
          
          return {
            response: "❌ 权限不足\n\n只有群组管理员可以添加操作人权限",
            success: false,
            userName: inputData.userName,
            chatId: inputData.chatId,
          };
        }
        
        let targetUserId: string | null = null;
        let targetUserName: string | null = null;
        
        // 方式1: 检查是否是回复消息
        if (inputData.replyToMessage) {
          targetUserId = inputData.replyToMessage.from.id.toString();
          targetUserName = inputData.replyToMessage.from.username || inputData.replyToMessage.from.first_name;
          logger?.info("✅ [Permission] 从回复消息获取用户", {
            userId: targetUserId,
            userName: targetUserName,
          });
        }
        // 方式2: 检查是否@了某人 (text_mention)
        else if (inputData.entities && inputData.entities.length > 0) {
          for (const entity of inputData.entities) {
            if (entity.type === "text_mention" && entity.user) {
              targetUserId = entity.user.id.toString();
              targetUserName = entity.user.username || entity.user.first_name;
              logger?.info("✅ [Permission] 从text_mention获取用户", {
                userId: targetUserId,
                userName: targetUserName,
              });
              break;
            }
          }
        }
        
        if (!targetUserId) {
          return {
            response: "❌ 添加权限失败\n\n请使用以下方式之一：\n1. 回复某人的消息，然后发送「添加权限」\n2. @某人（无username的用户）并发送「添加权限」\n\n💡 推荐使用方式1（回复消息）",
            success: false,
            userName: inputData.userName,
            chatId: inputData.chatId,
          };
        }
        
        // 调用addOperator工具
        const addOperatorTool = await import("../tools/groupAccountingTools");
        const result = await addOperatorTool.addOperator.execute({
          context: {
            groupId,
            userId: targetUserId,
            username: targetUserName || "unknown",
          },
          runtimeContext,
        });
        
        return {
          response: result.message,
          success: result.success,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 移除权限命令
      if (msg.includes("移除权限") || msg.includes("删除操作人")) {
        logger?.info("🔑 [Permission] 检测到移除权限命令");
        
        // 🔒 验证管理员身份（动态检查Telegram群组管理员）
        const isAdmin = await isGroupAdmin(inputData.chatId, inputData.userId, logger);
        
        if (!isAdmin) {
          logger?.info("❌ [Permission] 非管理员尝试移除权限", {
            userId: inputData.userId,
            userName: inputData.userName,
          });
          
          return {
            response: "❌ 权限不足\n\n只有群组管理员可以移除操作人权限",
            success: false,
            userName: inputData.userName,
            chatId: inputData.chatId,
          };
        }
        
        let targetUserId: string | null = null;
        
        // 从回复消息获取用户ID（更可靠）
        if (inputData.replyToMessage) {
          targetUserId = inputData.replyToMessage.from.id.toString();
        }
        
        if (!targetUserId) {
          return {
            response: "❌ 移除权限失败\n\n请回复某人的消息，然后发送「移除权限」",
            success: false,
            userName: inputData.userName,
            chatId: inputData.chatId,
          };
        }
        
        const removeOperatorTool = await import("../tools/groupAccountingTools");
        const result = await removeOperatorTool.removeOperator.execute({
          context: {
            groupId,
            userId: targetUserId,
          },
          runtimeContext,
        });
        
        return {
          response: result.message,
          success: result.success,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 查看操作人列表 (无需管理员权限，任何人都可以查看)
      if (msg === "操作人列表" || msg === "查看操作人") {
        logger?.info("🔑 [Permission] 检测到查看操作人命令");
        
        const listOperatorsTool = await import("../tools/groupAccountingTools");
        const result = await listOperatorsTool.listOperators.execute({
          context: { groupId },
          runtimeContext,
        });
        
        return {
          response: result.message,
          success: result.success,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 🔒 权限检查：只有授权用户才能使用机器人
      logger?.info("🔒 [Permission] 开始权限检查", {
        userId: inputData.userId,
        userName: inputData.userName,
      });
      
      // 🔑 优先检查是否是Telegram群组管理员（管理员自动拥有所有权限）
      const isAdmin = await isGroupAdmin(inputData.chatId, inputData.userId, logger);
      
      if (isAdmin) {
        logger?.info("✅ [Permission] 群组管理员，自动通过权限验证", {
          userId: inputData.userId,
          userName: inputData.userName,
        });
      } else {
        // 非管理员，检查操作人权限
        const permissionResult = await checkUserPermission.execute({
          context: {
            groupId,
            userId: inputData.userId,
          },
          runtimeContext,
        });
        
        if (!permissionResult.hasPermission) {
          logger?.info("❌ [Permission] 无权限", {
            userId: inputData.userId,
            reason: permissionResult.reason,
          });
          
          return {
            response: `❌ 您没有权限使用此机器人\n原因: ${permissionResult.reason}\n\n💡 发送 "我的ID" 查看您的用户ID，然后联系管理员添加权限`,
            success: false,
            userName: inputData.userName,
            chatId: inputData.chatId,
          };
        }
        
        logger?.info("✅ [Permission] 权限验证通过（操作人）", {
          userId: inputData.userId,
          reason: permissionResult.reason,
        });
      }
      
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
          response: `✅ 入款成功: +${currency === "USD" ? "$" : "฿"}${amount}\n\n${billsResult.message}`,
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
          response: `✅ 出款成功: -${currency === "USD" ? "$" : "฿"}${amount}\n\n${billsResult.message}`,
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
      
      // 匹配 日结算
      if (msg === "日结算" || msg === "今日结算") {
        logger?.info("✅ [FastMatch] 匹配到日结算命令");
        
        const settlementResult = await dailySettlement.execute({
          context: { groupId },
          runtimeContext,
        });
        
        return {
          response: settlementResult.message,
          success: settlementResult.success,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 匹配 入款费率X
      const incomeFeeMatch = msg.match(/^入款费率\s*(-?\d+(?:\.\d+)?)$/);
      if (incomeFeeMatch) {
        const rate = parseFloat(incomeFeeMatch[1]);
        
        // 验证费率范围
        if (rate < -100 || rate > 100) {
          return {
            response: "❌ 费率必须在 -100% 到 100% 之间",
            success: false,
            userName: inputData.userName,
            chatId: inputData.chatId,
          };
        }
        
        logger?.info("✅ [FastMatch] 匹配到入款费率设置命令", { rate });
        
        const result = await setIncomeFeeRate.execute({
          context: { groupId, rate },
          runtimeContext,
        });
        
        return {
          response: result.message,
          success: result.success,
          userName: inputData.userName,
          chatId: inputData.chatId,
        };
      }
      
      // 匹配 下发费率X
      const outgoingFeeMatch = msg.match(/^下发费率\s*(-?\d+(?:\.\d+)?)$/);
      if (outgoingFeeMatch) {
        const rate = parseFloat(outgoingFeeMatch[1]);
        
        // 验证费率范围
        if (rate < -100 || rate > 100) {
          return {
            response: "❌ 费率必须在 -100% 到 100% 之间",
            success: false,
            userName: inputData.userName,
            chatId: inputData.chatId,
          };
        }
        
        logger?.info("✅ [FastMatch] 匹配到下发费率设置命令", { rate });
        
        const result = await setOutgoingFeeRate.execute({
          context: { groupId, rate },
          runtimeContext,
        });
        
        return {
          response: result.message,
          success: result.success,
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
      
      // 未匹配到命令 - 不再自动发送命令列表
      logger?.info("❓ [FastMatch] 未识别的命令，忽略");
      return {
        response: "",
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
    
    // 如果response为空，跳过发送（未识别的命令）
    if (!inputData.response || inputData.response.trim() === "") {
      logger?.info("⏭️ [SendTelegramResponse] 响应为空，跳过发送");
      return {
        sent: false,
        message: "",
      };
    }
    
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
            parse_mode: "Markdown",
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
    entities: z.array(z.any()).optional(),
    replyToMessage: z.object({
      from: z.object({
        id: z.number(),
        username: z.string().optional(),
        first_name: z.string(),
      }),
    }).optional(),
  }),
  
  outputSchema: z.object({
    sent: z.boolean(),
    message: z.string(),
  }),
})
  .then(processAccountingMessage)
  .then(sendTelegramResponse)
  .commit();
