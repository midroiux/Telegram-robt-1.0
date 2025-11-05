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

          // 处理按钮点击 (callback_query)
          if (payload.callback_query) {
            logger?.info("🔘 [Telegram] 收到按钮点击", {
              data: payload.callback_query.data,
              username: payload.callback_query.from?.username,
            });

            await handleCallbackQuery(mastra, payload.callback_query);
            return c.text("OK", 200);
          }

          // 处理普通消息
          if (payload.message) {
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
          // 检测是否是账单消息（包含"TOM记账机器人"）
          const isBillMessage = output.message.includes("TOM记账机器人");
          let replyMarkup;
          
          if (isBillMessage) {
            // 获取当前语言
            const { getGroupSettings } = await import("../mastra/tools/rateTools");
            const groupId = triggerInfo.params.chatId.toString();
            
            const settings = await getGroupSettings.execute({
              context: { groupId },
              mastra,
              runtimeContext: undefined as any,
            });
            
            const currentLanguage = settings.language || "中文";
            const nextLanguage = currentLanguage === "中文" ? "泰语" : "中文";
            
            // 添加语言切换按钮
            replyMarkup = {
              inline_keyboard: [[
                {
                  text: currentLanguage === "中文" ? "🇹🇭 切换泰语" : "🇨🇳 切换中文",
                  callback_data: JSON.stringify({
                    action: "switch_language",
                    language: nextLanguage,
                    groupId: groupId,
                  }),
                },
              ]],
            };
          }
          
          await sendTelegramMessage(
            triggerInfo.params.chatId,
            output.message,
            replyMarkup
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
 * 处理 Telegram 按钮点击
 */
async function handleCallbackQuery(mastra: Mastra, callbackQuery: any) {
  const logger = mastra.getLogger();
  
  try {
    const data = JSON.parse(callbackQuery.data);
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id.toString();
    const username = callbackQuery.from.username || "unknown";
    
    logger?.info("🔘 [Callback] 解析数据", { data, chatId, userId });
    
    // 处理语言切换
    if (data.action === "switch_language") {
      const { setLanguage } = await import("../mastra/tools/rateTools");
      const { showAllBills } = await import("../mastra/tools/queryTools");
      
      // 设置新语言
      await setLanguage.execute({
        context: {
          groupId: data.groupId,
          language: data.language,
        },
        mastra,
        runtimeContext: undefined as any,
      });
      
      // 获取更新后的账单
      const billResult = await showAllBills.execute({
        context: {
          groupId: data.groupId,
        },
        mastra,
        runtimeContext: undefined as any,
      });
      
      if (billResult.success) {
        // 创建新的语言切换按钮
        const newLanguage = data.language === "中文" ? "泰语" : "中文";
        const inlineKeyboard = {
          inline_keyboard: [[
            {
              text: data.language === "中文" ? "🇹🇭 切换泰语" : "🇨🇳 切换中文",
              callback_data: JSON.stringify({
                action: "switch_language",
                language: newLanguage,
                groupId: data.groupId,
              }),
            },
          ]],
        };
        
        // 编辑原消息
        await editTelegramMessage(chatId, messageId, billResult.message, inlineKeyboard);
      }
      
      // 回复callback确认（移除loading状态）
      await answerCallbackQuery(callbackQuery.id, data.language === "中文" ? "已切换为中文" : "ตั้งค่าภาษาไทยแล้ว");
    }
  } catch (error: any) {
    logger?.error("❌ [Callback] 处理失败", { error: error.message });
    await answerCallbackQuery(callbackQuery.id, "操作失败，请重试");
  }
}

/**
 * 编辑 Telegram 消息
 */
async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: any
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN 未设置");
    return;
  }

  try {
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "Markdown",
    };
    
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/editMessageText`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error("编辑 Telegram 消息失败:", await response.text());
    }
  } catch (error) {
    console.error("编辑 Telegram 消息出错:", error);
  }
}

/**
 * 回复 callback query
 */
async function answerCallbackQuery(callbackQueryId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN 未设置");
    return;
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: false,
        }),
      }
    );
  } catch (error) {
    console.error("回复 callback query 出错:", error);
  }
}

/**
 * 发送消息到 Telegram
 */
async function sendTelegramMessage(
  chatId: number, 
  text: string, 
  replyMarkup?: any
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN 未设置");
    return;
  }

  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    };
    
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error("发送 Telegram 消息失败:", await response.text());
    }
  } catch (error) {
    console.error("发送 Telegram 消息出错:", error);
  }
}
