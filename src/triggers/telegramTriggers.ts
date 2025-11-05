import type { ContentfulStatusCode } from "hono/utils/http-status";

import { registerApiRoute } from "../mastra/inngest";
import { Mastra } from "@mastra/core";
import { accountingWorkflow } from "../mastra/workflows/accountingWorkflow";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn(
    "Trying to initialize Telegram triggers without TELEGRAM_BOT_TOKEN. Can you confirm that the Telegram integration is configured correctly?",
  );
}

export type TriggerInfoTelegramOnNewMessage = {
  type: "telegram/message";
  params: {
    userName: string;
    message: string;
    userId: string;
    chatId: number;
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

          logger?.info("📝 [Telegram] 收到消息", {
            username: payload.message?.from?.username,
            text: payload.message?.text,
          });

          await handler(mastra, {
            type: triggerType,
            params: {
              userName: payload.message.from.username || "unknown",
              message: payload.message.text || "",
              userId: payload.message.from.id.toString(),
              chatId: payload.message.chat.id,
            },
            payload,
          } as TriggerInfoTelegramOnNewMessage);

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
      // 执行记账 workflow
      const run = await accountingWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          userName: triggerInfo.params.userName,
          message: triggerInfo.params.message,
          userId: triggerInfo.params.userId,
        },
      });

      logger?.info("✅ [AccountingBot] Workflow 执行完成", {
        status: result.status,
      });

      // 发送响应回 Telegram
      if (result.status === "success") {
        const output = result.result;
        if (output?.message && triggerInfo.params.chatId) {
          await sendTelegramMessage(
            triggerInfo.params.chatId,
            output.message
          );
        }
      } else {
        logger?.error("❌ [AccountingBot] Workflow 失败", {
          error: result.status === "failed" ? result.error : "Unknown error",
        });
        
        if (triggerInfo.params.chatId) {
          await sendTelegramMessage(
            triggerInfo.params.chatId,
            "抱歉,处理您的请求时出现问题。"
          );
        }
      }
    } catch (error: any) {
      logger?.error("❌ [AccountingBot] Workflow 执行失败", {
        error: error.message,
      });

      // 发送错误消息给用户
      if (triggerInfo.params.chatId) {
        await sendTelegramMessage(
          triggerInfo.params.chatId,
          `抱歉,处理您的请求时出现错误。请稍后再试。`
        );
      }
    }
  },
});

/**
 * 发送消息到 Telegram
 */
async function sendTelegramMessage(chatId: number, text: string) {
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
          parse_mode: "Markdown",
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
