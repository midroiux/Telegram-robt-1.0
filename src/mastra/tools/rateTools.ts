import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUncachableGoogleSheetClient } from "../../integrations/googleSheets";

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
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
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
          range: `GroupSettings!B${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.rate]],
          },
        });
      } else {
        // 创建新设置
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "GroupSettings!A:J",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              context.rate,
              5, // 默认入款费率
              0, // 默认下发费率
              6, // 默认日切时间
              "否", // 默认不是所有人
              "否", // 默认不使用实时汇率
              "",
              "否",
              "中文", // 默认语言
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
 * Tool: Set Income Fee Rate
 * 设置入款费率
 */
export const setIncomeFeeRate = createTool({
  id: "set-income-fee-rate",
  description: "设置群组的入款手续费率,格式: 设置入款费率25 或 入款费率25",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    rate: z.number().describe("入款费率值,可以是正数或负数"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetIncomeFeeRate] 设置入款费率", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
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
          range: `GroupSettings!C${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.rate]],
          },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "GroupSettings!A:J",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              35, // 默认汇率 THB/USD
              context.rate, // 入款费率
              0, // 默认下发费率 0%
              6, // 默认日切时间
              "否", // 默认不是所有人
              "否", // 默认不使用实时汇率
              "",
              "否",
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetIncomeFeeRate] 入款费率设置成功");
      
      return {
        success: true,
        message: `✅ 已设置入款费率: ${context.rate}%`,
      };
    } catch (error: any) {
      logger?.error("❌ [SetIncomeFeeRate] 设置失败", error);
      return {
        success: false,
        message: `❌ 设置失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Set Outgoing Fee Rate
 * 设置下发费率
 */
export const setOutgoingFeeRate = createTool({
  id: "set-outgoing-fee-rate",
  description: "设置群组的下发手续费率,格式: 设置下发费率5 或 下发费率5",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    rate: z.number().describe("下发费率值,可以是正数或负数"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetOutgoingFeeRate] 设置下发费率", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
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
          range: `GroupSettings!D${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.rate]],
          },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "GroupSettings!A:J",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              35, // 默认汇率 THB/USD
              5, // 默认入款费率 5%
              context.rate, // 下发费率
              6, // 默认日切时间
              "否", // 默认不是所有人
              "否", // 默认不使用实时汇率
              "",
              "否",
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetOutgoingFeeRate] 下发费率设置成功");
      
      return {
        success: true,
        message: `✅ 已设置下发费率: ${context.rate}%`,
      };
    } catch (error: any) {
      logger?.error("❌ [SetOutgoingFeeRate] 设置失败", error);
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
    incomeFeeRate: z.number(),
    outgoingFeeRate: z.number(),
    cutoffTime: z.number(),
    allUsersMode: z.boolean(),
    realtimeRate: z.boolean(),
    language: z.string(),
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
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
      });
      
      const rows = response.data.values || [];
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          const exchangeRate = parseFloat(rows[i][1] || "35");
          const incomeFeeRate = parseFloat(rows[i][2] || "5");
          const outgoingFeeRate = parseFloat(rows[i][3] || "0");
          const cutoffTime = parseInt(rows[i][4] || "6");
          const allUsersMode = rows[i][5] === "是";
          const realtimeRate = rows[i][6] === "是";
          const language = rows[i][9] || "中文";
          
          logger?.info("✅ [GetGroupSettings] 获取成功");
          
          return {
            success: true,
            exchangeRate,
            incomeFeeRate,
            outgoingFeeRate,
            cutoffTime,
            allUsersMode,
            realtimeRate,
            language,
            message: `当前设置:\n汇率: ${exchangeRate}\n入款费率: ${incomeFeeRate}%\n下发费率: ${outgoingFeeRate}%\n日切时间: ${cutoffTime}点`,
          };
        }
      }
      
      // 返回默认设置
      return {
        success: true,
        exchangeRate: 35,
        incomeFeeRate: 5,
        outgoingFeeRate: 0,
        cutoffTime: 6,
        allUsersMode: false,
        realtimeRate: false,
        language: "中文",
        message: "当前使用默认设置:\n汇率: 35\n入款费率: 5%\n下发费率: 0%\n日切时间: 6点",
      };
    } catch (error: any) {
      logger?.error("❌ [GetGroupSettings] 获取失败", error);
      return {
        success: false,
        exchangeRate: 35,
        incomeFeeRate: 5,
        outgoingFeeRate: 0,
        cutoffTime: 6,
        allUsersMode: false,
        realtimeRate: false,
        language: "中文",
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
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
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
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:H",
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
          range: "GroupSettings!A:H",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              35, // 默认汇率 THB/USD
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
 * Tool: Set Cutoff Time
 * 设置日切时间
 */
export const setCutoffTime = createTool({
  id: "set-cutoff-time",
  description: "设置每日结算时间(日切时间),格式: 日切#6 表示早上6点",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    hour: z.number().min(0).max(23).describe("日切时间(小时,0-23)"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetCutoffTime] 设置日切时间", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:H",
      });
      
      const rows = response.data.values || [];
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          // 只更新日切时间(E列)，不更新最后刷新时间
          // 最后刷新时间会在查询账单时自动更新
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `GroupSettings!E${i + 1}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [[context.hour]],
            },
          });
          
          logger?.info("✅ [SetCutoffTime] 设置成功");
          
          return {
            success: true,
            message: `✅ 日切时间已设置为: ${context.hour}:00\n⏰ 系统将在每天 ${context.hour}:00 自动重新开始统计账单`,
          };
        }
      }
      
      // 如果群组不存在,创建新记录
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "GroupSettings!A:J",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[
            context.groupId,
            35, // B: 汇率
            5, // C: 入款费率
            0, // D: 下发费率
            context.hour, // E: 日切时间
            "否", // F: 所有人可用
            "否", // G: 实时汇率
            "", // H: 最后刷新时间（首次查询账单时自动设置）
            "否", // I: 禁言状态
            "中文", // J: 语言
          ]],
        },
      });
      
      logger?.info("✅ [SetCutoffTime] 新建群组并设置成功");
      
      return {
        success: true,
        message: `✅ 日切时间已设置为: ${context.hour}:00\n⏰ 系统将在每天 ${context.hour}:00 自动重新开始统计账单`,
      };
    } catch (error: any) {
      logger?.error("❌ [SetCutoffTime] 设置失败", error);
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
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
      });
      
      const rows = response.data.values || [];
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId) {
          const exchangeRate = parseFloat(rows[i][1] || "35");
          const incomeFeeRate = parseFloat(rows[i][2] || "5");
          const outgoingFeeRate = parseFloat(rows[i][3] || "0");
          const isRealtime = rows[i][6] === "是";
          
          const message = `📊 当前汇率情况:\n\n` +
            `💱 汇率: ${exchangeRate} THB/USD (฿/$)\n` +
            `💰 入款费率: ${incomeFeeRate}%\n` +
            `💸 下发费率: ${outgoingFeeRate}%\n` +
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
        message: `📊 当前汇率情况:\n\n💱 汇率: 35 THB/USD (฿/$)\n💰 入款费率: 5%\n💸 下发费率: 0%\n📌 使用默认设置`,
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

/**
 * Tool: Set Language
 * 设置账单显示语言
 */
export const setLanguage = createTool({
  id: "set-language",
  description: "设置账单显示语言,支持中文和泰语,命令: 切换泰语 或 切换中文",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    language: z.enum(["中文", "泰语"]).describe("语言选择: 中文 或 泰语"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetLanguage] 设置语言", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
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
          range: `GroupSettings!J${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.language]],
          },
        });
      } else {
        // 创建新设置
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "GroupSettings!A:J",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              context.groupId,
              35, // 默认汇率
              5, // 默认入款费率
              0, // 默认下发费率
              6, // 默认日切时间
              "否", // 默认不是所有人
              "否", // 默认不使用实时汇率
              "",
              "否",
              context.language,
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetLanguage] 语言设置成功");
      
      const confirmMessage = context.language === "泰语" 
        ? "✅ ตั้งค่าภาษาไทยเรียบร้อยแล้ว" 
        : "✅ 已切换为中文";
      
      return {
        success: true,
        message: confirmMessage,
      };
    } catch (error: any) {
      logger?.error("❌ [SetLanguage] 设置失败", error);
      return {
        success: false,
        message: `❌ 设置失败: ${error.message}`,
      };
    }
  },
});
