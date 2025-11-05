import { inngest } from "../inngest/client";
import { RuntimeContext } from "@mastra/core/di";
import { dailySettlement } from "../tools/queryTools";
import { getUncachableGoogleSheetClient } from "../../integrations/googleSheets";

/**
 * Daily Settlement Cron Function
 * 每天0点（UTC）自动触发结算并发送报告到Telegram
 * 支持多群组：自动获取所有活跃群组并分别结算
 */
export const dailySettlementCron = inngest.createFunction(
  {
    id: "daily-settlement-cron",
    name: "Daily Settlement Cron (Midnight UTC)",
  },
  { cron: "0 0 * * *" }, // 每天0点 UTC
  async ({ step, logger }) => {
    logger.info("🕐 [Cron] 定时任务触发：每日结算（多群组）");
    
    // Step 1: 获取所有活跃群组列表
    const activeGroups = await step.run("get-active-groups", async () => {
      try {
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        if (!spreadsheetId) {
          throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
        }
        
        const sheets = await getUncachableGoogleSheetClient();
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "GroupSettings!A:D",
        });
        
        const rows = response.data.values || [];
        const groups: Array<{groupId: string, chatId: number}> = [];
        
        // 从第2行开始读取（跳过表头）
        for (let i = 1; i < rows.length; i++) {
          const groupId = rows[i][0];
          if (groupId) {
            const chatId = parseInt(groupId); // GroupID就是ChatID
            groups.push({ groupId, chatId });
          }
        }
        
        logger.info(`📋 [GetActiveGroups] 找到 ${groups.length} 个活跃群组`, { groups });
        return groups;
      } catch (error: any) {
        logger.error("❌ [GetActiveGroups] 获取群组列表失败", { error: error.message });
        return [];
      }
    });
    
    // Step 2: 对每个群组执行结算并发送报告
    const results = await step.run("settle-all-groups", async () => {
      const runtimeContext = new RuntimeContext();
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const groupResults = [];
      
      if (!botToken) {
        logger.error("❌ TELEGRAM_BOT_TOKEN 未设置");
        return [];
      }
      
      for (const group of activeGroups) {
        try {
          // 执行结算
          const settlementResult = await dailySettlement.execute({
            context: { groupId: group.groupId },
            runtimeContext,
          });
          
          logger.info(`✅ [DailySettlement] 群组 ${group.groupId} 结算完成`, {
            success: settlementResult.success,
            netProfit: settlementResult.netProfit,
          });
          
          // 发送结算报告到群组
          const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                chat_id: group.chatId,
                text: settlementResult.message,
                parse_mode: "Markdown",
              }),
            }
          );

          if (response.ok) {
            logger.info(`✅ [SendReport] 群组 ${group.groupId} 报告已发送`);
            groupResults.push({
              groupId: group.groupId,
              success: true,
              netProfit: settlementResult.netProfit,
            });
          } else {
            const errorText = await response.text();
            logger.error(`❌ [SendReport] 群组 ${group.groupId} 发送失败`, { error: errorText });
            groupResults.push({
              groupId: group.groupId,
              success: false,
              error: errorText,
            });
          }
        } catch (error: any) {
          logger.error(`❌ [DailySettlement] 群组 ${group.groupId} 结算失败`, {
            error: error.message,
          });
          groupResults.push({
            groupId: group.groupId,
            success: false,
            error: error.message,
          });
        }
      }
      
      return groupResults;
    });
    
    logger.info("✅ [Cron] 每日结算流程完成", {
      totalGroups: activeGroups.length,
      successCount: results.filter(r => r.success).length,
    });
    
    return {
      success: true,
      message: `每日结算已完成，处理了 ${activeGroups.length} 个群组`,
      results,
    };
  }
);
