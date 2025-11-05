import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";

function getGoogleSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || "{}");
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

// ============= 汇率/费率管理工具 =============

/**
 * Tool: Set Exchange Rate
 * 设置汇率
 */
export const setExchangeRate = createTool({
  id: "set-exchange-rate",
  description: "设置群组的 THB/USD 汇率,格式: 设置汇率35",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    rate: z.number().describe("汇率值"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetExchangeRate] 设置汇率", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "群组设置!A:H",
      });
      
      const rows = response.data.values || [];
      let foundIndex = -1;
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          foundIndex = i;
          break;
        }
      }
      
      if (foundIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `群组设置!B${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.rate]],
          },
        });
      } else {
        // 创建新设置
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "群组设置!A:H",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              context.rate,
              5, // 默认费率
              6, // 默认日切时间
              "否", // 默认不是所有人
              "否", // 默认不使用实时汇率
              "",
              "否",
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetExchangeRate] 汇率设置成功");
      
      return {
        success: true,
        message: `✅ 已设置汇率: ${context.rate}`,
      };
    } catch (error: any) {
      logger?.error("❌ [SetExchangeRate] 设置失败", error);
      return {
        success: false,
        message: `❌ 设置失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Set Fee Rate
 * 设置费率
 */
export const setFeeRate = createTool({
  id: "set-fee-rate",
  description: "设置群组的手续费率,格式: 设置费率5 或 设置费率-5",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    rate: z.number().describe("费率值,可以是正数或负数"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetFeeRate] 设置费率", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "群组设置!A:H",
      });
      
      const rows = response.data.values || [];
      let foundIndex = -1;
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          foundIndex = i;
          break;
        }
      }
      
      if (foundIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `群组设置!C${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.rate]],
          },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "群组设置!A:H",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              7.2, // 默认汇率
              context.rate,
              6,
              "否",
              "否",
              "",
              "否",
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetFeeRate] 费率设置成功");
      
      const rateText = context.rate > 0 ? `${context.rate}%` : `上浮${Math.abs(context.rate)}%`;
      
      return {
        success: true,
        message: `✅ 已设置费率: ${rateText}`,
      };
    } catch (error: any) {
      logger?.error("❌ [SetFeeRate] 设置失败", error);
      return {
        success: false,
        message: `❌ 设置失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Get Group Settings
 * 获取群组设置
 */
export const getGroupSettings = createTool({
  id: "get-group-settings",
  description: "获取群组的汇率、费率等设置信息",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    exchangeRate: z.number(),
    feeRate: z.number(),
    cutoffTime: z.number(),
    allUsersMode: z.boolean(),
    realtimeRate: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [GetGroupSettings] 获取群组设置", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "群组设置!A:H",
      });
      
      const rows = response.data.values || [];
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          const exchangeRate = parseFloat(rows[i][1] || "7.2");
          const feeRate = parseFloat(rows[i][2] || "5");
          const cutoffTime = parseInt(rows[i][3] || "6");
          const allUsersMode = rows[i][4] === "是";
          const realtimeRate = rows[i][5] === "是";
          
          logger?.info("✅ [GetGroupSettings] 获取成功");
          
          return {
            success: true,
            exchangeRate,
            feeRate,
            cutoffTime,
            allUsersMode,
            realtimeRate,
            message: `当前设置:\n汇率: ${exchangeRate}\n费率: ${feeRate}%\n日切时间: ${cutoffTime}点`,
          };
        }
      }
      
      // 返回默认设置
      return {
        success: true,
        exchangeRate: 35,
        feeRate: 5,
        cutoffTime: 6,
        allUsersMode: false,
        realtimeRate: false,
        message: "当前使用默认设置:\n汇率: 35\n费率: 5%\n日切时间: 6点",
      };
    } catch (error: any) {
      logger?.error("❌ [GetGroupSettings] 获取失败", error);
      return {
        success: false,
        exchangeRate: 35,
        feeRate: 5,
        cutoffTime: 6,
        allUsersMode: false,
        realtimeRate: false,
        message: `❌ 获取失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Convert THB to USD
 * 将泰铢转换为美元 (z100命令)
 */
export const convertTHBtoUSD = createTool({
  id: "convert-thb-to-usd",
  description: "将泰铢金额转换为美元,格式: z100 (将100฿转换为$)",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    amount: z.number().describe("泰铢金额"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    thbAmount: z.number(),
    usdAmount: z.number(),
    exchangeRate: z.number(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ConvertTHBtoUSD] 转换金额", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "群组设置!A:H",
      });
      
      const rows = response.data.values || [];
      let exchangeRate = 35; // 默认汇率 THB/USD
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          exchangeRate = parseFloat(rows[i][1] || "35");
          break;
        }
      }
      
      const usdAmount = context.amount / exchangeRate;
      
      logger?.info("✅ [ConvertTHBtoUSD] 转换成功");
      
      return {
        success: true,
        thbAmount: context.amount,
        usdAmount: parseFloat(usdAmount.toFixed(2)),
        exchangeRate,
        message: `💱 ฿${context.amount} = $${usdAmount.toFixed(2)}\n汇率: ${exchangeRate}`,
      };
    } catch (error: any) {
      logger?.error("❌ [ConvertTHBtoUSD] 转换失败", error);
      return {
        success: false,
        thbAmount: context.amount,
        usdAmount: 0,
        exchangeRate: 0,
        message: `❌ 转换失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Set Realtime Rate Mode
 * 设置实时汇率模式
 */
export const setRealtimeRateMode = createTool({
  id: "set-realtime-rate-mode",
  description: "启用或禁用实时汇率模式",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    enabled: z.boolean().describe("是否启用实时汇率"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetRealtimeRateMode] 设置实时汇率", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "群组设置!A:H",
      });
      
      const rows = response.data.values || [];
      let foundIndex = -1;
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          foundIndex = i;
          break;
        }
      }
      
      if (foundIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `群组设置!F${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.enabled ? "是" : "否"]],
          },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "群组设置!A:H",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              7.2,
              5,
              6,
              "否",
              context.enabled ? "是" : "否",
              "",
              "否",
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetRealtimeRateMode] 设置成功");
      
      return {
        success: true,
        message: context.enabled ? "✅ 已启用实时汇率模式" : "✅ 已关闭实时汇率模式",
      };
    } catch (error: any) {
      logger?.error("❌ [SetRealtimeRateMode] 设置失败", error);
      return {
        success: false,
        message: `❌ 设置失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Show Current Rates
 * 显示当前汇率情况 (z0命令)
 */
export const showCurrentRates = createTool({
  id: "show-current-rates",
  description: "显示群组当前的汇率和费率信息,命令: z0",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ShowCurrentRates] 显示汇率", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "群组设置!A:H",
      });
      
      const rows = response.data.values || [];
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          const exchangeRate = parseFloat(rows[i][1] || "35");
          const feeRate = parseFloat(rows[i][2] || "5");
          const isRealtime = rows[i][5] === "是";
          
          const message = `📊 当前汇率情况:\n\n` +
            `💱 汇率: ${exchangeRate} THB/USD (฿/$)\n` +
            `💰 费率: ${feeRate}%\n` +
            `${isRealtime ? '🌐 实时汇率: 已启用' : '📌 固定汇率模式'}`;
          
          logger?.info("✅ [ShowCurrentRates] 显示成功");
          
          return {
            success: true,
            message,
          };
        }
      }
      
      return {
        success: true,
        message: `📊 当前汇率情况:\n\n💱 汇率: 35 THB/USD (฿/$)\n💰 费率: 5%\n📌 使用默认设置`,
      };
    } catch (error: any) {
      logger?.error("❌ [ShowCurrentRates] 显示失败", error);
      return {
        success: false,
        message: `❌ 显示失败: ${error.message}`,
      };
    }
  },
});
