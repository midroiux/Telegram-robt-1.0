import { inngest } from "../inngest/client";
import { RuntimeContext } from "@mastra/core/di";
import { deleteAllRecords } from "../tools/transactionTools";

/**
 * Weekly Cleanup Cron Function
 * 每7天自动清除所有记录并发送通知到Telegram
 */
export const weeklyCleanupCron = inngest.createFunction(
  {
    id: "weekly-cleanup-cron",
    name: "Weekly Cleanup Cron (Every 7 Days at Midnight UTC)",
  },
  { cron: "0 0 * * 0" }, // 每周日0点 UTC（每7天）
  async ({ step, logger }) => {
    logger.info("🕐 [Cron] 定时任务触发：每7天自动清理数据");
    
    // 群组ID和ChatID
    const groupId = "-4948354487"; // 固定群组ID
    const chatId = -4948354487; // Telegram群组ChatID
    
    // Step 1: 执行数据清理
    const cleanupResult = await step.run("run-weekly-cleanup", async () => {
      const runtimeContext = new RuntimeContext();
      
      try {
        const result = await deleteAllRecords.execute({
          context: {
            groupId,
          },
          runtimeContext,
        });
        
        logger.info("✅ [WeeklyCleanup] 清理完成", {
          success: result.success,
        });
        
        return result;
      } catch (error: any) {
        logger.error("❌ [WeeklyCleanup] 清理失败", {
          error: error.message,
        });
        
        throw error;
      }
    });
    
    // Step 2: 发送清理通知到Telegram
    const sendResult = await step.run("send-cleanup-notification", async () => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        logger.error("❌ TELEGRAM_BOT_TOKEN 未设置");
        throw new Error("TELEGRAM_BOT_TOKEN 未设置");
      }

      try {
        const notificationMessage = `🔄 *每周自动清理*\n\n${cleanupResult.message}\n\n系统将重新开始记录新的账单数据`;
        
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: notificationMessage,
              parse_mode: "Markdown",
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("❌ [SendCleanupNotification] 发送失败", { error: errorText });
          throw new Error(`发送Telegram消息失败: ${errorText}`);
        }

        logger.info("✅ [SendCleanupNotification] 清理通知已发送");
        
        return {
          sent: true,
          message: notificationMessage,
        };
      } catch (error: any) {
        logger.error("❌ [SendCleanupNotification] 发送失败", {
          error: error.message,
        });
        throw error;
      }
    });
    
    return {
      cleanup: cleanupResult,
      notification: sendResult,
    };
  }
);
