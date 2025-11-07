import type { ContentfulStatusCode } from "hono/utils/http-status";

import { registerApiRoute } from "../mastra/inngest";
import { Mastra } from "@mastra/core";
import { accountingWorkflow } from "../mastra/workflows/accountingWorkflow";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn(
    "Trying to initialize Telegram triggers without TELEGRAM_BOT_TOKEN. Can you confirm that the Telegram integration is configured correctly?",
  );
}

/**
 * 重复消息检测缓存
 * 存储已处理的update_id，防止重复处理
 * TTL: 1小时（足够防止重试，又不会占用太多内存）
 */
const processedUpdates = new Map<number, number>();
const UPDATE_CACHE_TTL = 60 * 60 * 1000; // 1小时

/**
 * 检查是否是重复的Telegram update
 */
function checkDuplicateUpdate(updateId: number, logger?: any): boolean {
  const now = Date.now();
  
  // 清理过期的缓存（每次检查时顺便清理）
  for (const [id, timestamp] of processedUpdates.entries()) {
    if (now - timestamp > UPDATE_CACHE_TTL) {
      processedUpdates.delete(id);
    }
  }
  
  // 检查是否已处理
  if (processedUpdates.has(updateId)) {
    logger?.warn("⚠️ [Telegram] 检测到重复update，忽略", {
      updateId,
      firstProcessedAgo: Math.round((now - processedUpdates.get(updateId)!) / 1000) + "秒前",
    });
    return true; // 是重复的
  }
  
  // 记录为已处理
  processedUpdates.set(updateId, now);
  return false; // 不是重复的
}

export type TriggerInfoTelegramOnNewMessage = {
  type: "telegram/message";
  params: {
    userName: string;
    message: string;
    userId: string;
    chatId: number;
    // 完整的Telegram消息对象
    entities?: any[];
    replyToMessage?: {
      from: {
        id: number;
        username?: string;
        first_name: string;
      };
    };
  };
  payload: any;
};

export function registerTelegramTrigger({
  triggerType,
  handler,
}: {
  triggerType: string;
  handler: (
    mastra: Mastra,
    triggerInfo: TriggerInfoTelegramOnNewMessage,
  ) => Promise<void>;
}) {
  return [
    registerApiRoute("/webhooks/telegram/action", {
      method: "POST",
      handler: async (c) => {
        const mastra = c.get("mastra");
        const logger = mastra.getLogger();
        try {
          const payload = await c.req.json();

          logger?.info("📦 [Telegram] 收到完整payload", {
            payload: JSON.stringify(payload, null, 2),
          });

          // 🔒 检查是否是重复的update（防止重复处理）
          if (payload.update_id && checkDuplicateUpdate(payload.update_id, logger)) {
            return c.text("OK", 200); // 重复消息，直接返回OK
          }

          // 处理普通消息
          if (payload.message) {
            logger?.info("📝 [Telegram] 收到消息", {
              username: payload.message?.from?.username,
              text: payload.message?.text,
              caption: payload.message?.caption,
              messageType: Object.keys(payload.message).filter(k => 
                !['message_id', 'from', 'chat', 'date'].includes(k)
              ),
            });

            await handler(mastra, {
              type: triggerType,
              params: {
                userName: payload.message.from.username || "unknown",
                message: payload.message.text || "",
                userId: payload.message.from.id.toString(),
                chatId: payload.message.chat.id,
                // 传递完整的entities和reply信息用于权限管理
                entities: payload.message.entities || [],
                replyToMessage: payload.message.reply_to_message ? {
                  from: {
                    id: payload.message.reply_to_message.from.id,
                    username: payload.message.reply_to_message.from.username,
                    first_name: payload.message.reply_to_message.from.first_name,
                  }
                } : undefined,
              },
              payload,
            } as TriggerInfoTelegramOnNewMessage);
          }

          return c.text("OK", 200);
        } catch (error) {
          logger?.error("❌ [Telegram] 处理 webhook 失败:", error);
          return c.text("Internal Server Error", 500);
        }
      },
    }),
  ];
}

// 注册记账机器人的 Telegram 触发器
export const accountingBotTrigger = registerTelegramTrigger({
  triggerType: "telegram/accounting",
  handler: async (mastra, triggerInfo) => {
    const logger = mastra.getLogger();
    
    logger?.info("🤖 [AccountingBot] 开始处理记账请求", {
      userName: triggerInfo.params.userName,
      message: triggerInfo.params.message,
    });

    try {
      // 🚀 Fire-and-forget: 启动workflow但不等待结果
      // Workflow会自己发送Telegram消息
      const run = await accountingWorkflow.createRunAsync();
      
      // 不等待workflow完成，立即返回
      run.start({
        inputData: {
          userName: triggerInfo.params.userName,
          message: triggerInfo.params.message,
          userId: triggerInfo.params.userId,
          chatId: triggerInfo.params.chatId,
          entities: triggerInfo.params.entities,
          replyToMessage: triggerInfo.params.replyToMessage,
        },
      }).catch((error) => {
        logger?.error("❌ [AccountingBot] Workflow 启动失败", {
          error: error.message,
        });
      });

      logger?.info("✅ [AccountingBot] Workflow 已异步启动，不等待结果");
      
    } catch (error: any) {
      logger?.error("❌ [AccountingBot] 创建 Workflow 失败", {
        error: error.message,
      });
    }
  },
});

/**
 * 发送消息到 Telegram
 */
async function sendTelegramMessage(
  chatId: number, 
  text: string
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN 未设置");
    return;
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
          chat_id: chatId,
          text: text,
          // 完全移除 parse_mode，使用纯文本
        }),
      }
    );

    if (!response.ok) {
      console.error("发送 Telegram 消息失败:", await response.text());
    }
  } catch (error) {
    console.error("发送 Telegram 消息出错:", error);
  }
}
