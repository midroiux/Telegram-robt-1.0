import { inngest } from "../inngest/client";
import { RuntimeContext } from "@mastra/core/di";
import { dailySettlement } from "../tools/queryTools";

/**
 * Daily Settlement Cron Function
 * 每天0点（UTC）自动触发结算并发送报告到Telegram
 */
export const dailySettlementCron = inngest.createFunction(
  {
    id: "daily-settlement-cron",
    name: "Daily Settlement Cron (Midnight UTC)",
  },
  { cron: "0 0 * * *" }, // 每天0点 UTC
  async ({ step, logger }) => {
    logger.info("🕐 [Cron] 定时任务触发：每日结算");
    
    // 群组ID和ChatID
    const groupId = "-4948354487"; // 固定群组ID
    const chatId = -4948354487; // Telegram群组ChatID
    
    // Step 1: 执行每日结算并获取报告
    const settlementResult = await step.run("run-daily-settlement", async () => {
      const runtimeContext = new RuntimeContext();
      
      try {
        const result = await dailySettlement.execute({
          context: {
            groupId,
          },
          runtimeContext,
        });
        
        logger.info("✅ [DailySettlement] 结算完成", {
          success: result.success,
          netProfit: result.netProfit,
        });
        
        return result;
      } catch (error: any) {
        logger.error("❌ [DailySettlement] 结算失败", {
          error: error.message,
        });
        
        throw error;
      }
    });
    
    // Step 2: 发送结算报告到Telegram
    const sendResult = await step.run("send-settlement-report", async () => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        logger.error("❌ TELEGRAM_BOT_TOKEN 未设置");
        throw new Error("TELEGRAM_BOT_TOKEN 未设置");
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
              text: settlementResult.message,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("❌ [SendSettlementReport] 发送失败", { error: errorText });
          throw new Error(`发送Telegram消息失败: ${errorText}`);
        }

        logger.info("✅ [SendSettlementReport] 结算报告已发送");
        
        return {
          sent: true,
          message: settlementResult.message,
        };
      } catch (error: any) {
        logger.error("❌ [SendSettlementReport] 发送异常", { error: error.message });
        throw error;
      }
    });
    
    logger.info("✅ [Cron] 每日结算流程完成");
    
    return {
      success: true,
      message: "每日结算已完成",
      settlementData: settlementResult,
      sendData: sendResult,
    };
  }
);
