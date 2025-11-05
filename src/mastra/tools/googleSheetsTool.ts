import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";

/**
 * Google Sheets Tools for Accounting Bot
 * 
 * These tools handle all interactions with Google Sheets for storing and retrieving
 * accounting data including income, expenses, settings, and daily summaries.
 */

// Initialize Google Sheets API
function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || "{}"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  
  return google.sheets({ version: "v4", auth });
}

/**
 * Tool: Add Income Record
 * Records an income transaction to Google Sheets
 */
export const addIncomeRecord = createTool({
  id: "add-income-record",
  description: "记录收入到 Google Sheets,包括金额、币种、日期时间等信息",
  
  inputSchema: z.object({
    amount: z.number().describe("收入金额"),
    currency: z.string().default("CNY").describe("币种,默认为 CNY"),
    category: z.string().optional().describe("收入类别"),
    description: z.string().optional().describe("收入描述"),
    date: z.string().optional().describe("日期,格式 YYYY-MM-DD,默认为当天"),
    time: z.string().optional().describe("时间,格式 HH:MM:SS,默认为当前时间"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    recordId: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [AddIncomeRecord] 开始执行", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      const now = new Date();
      const date = context.date || now.toISOString().split('T')[0];
      const time = context.time || now.toTimeString().split(' ')[0];
      const timestamp = `${date} ${time}`;
      
      const values = [[
        timestamp,
        "收入",
        context.amount,
        context.currency,
        context.category || "",
        context.description || "",
      ]];
      
      logger?.info("📝 [AddIncomeRecord] 准备写入数据", values);
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "收入!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      
      logger?.info("✅ [AddIncomeRecord] 成功记录收入");
      
      return {
        success: true,
        message: `成功记录收入: ${context.amount} ${context.currency}`,
        recordId: timestamp,
      };
    } catch (error: any) {
      logger?.error("❌ [AddIncomeRecord] 记录收入失败", { error: error.message });
      return {
        success: false,
        message: `记录收入失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Add Expense Record
 * Records an expense transaction to Google Sheets
 */
export const addExpenseRecord = createTool({
  id: "add-expense-record",
  description: "记录支出到 Google Sheets,包括金额、币种、日期时间等信息",
  
  inputSchema: z.object({
    amount: z.number().describe("支出金额"),
    currency: z.string().default("CNY").describe("币种,默认为 CNY"),
    category: z.string().optional().describe("支出类别"),
    description: z.string().optional().describe("支出描述"),
    date: z.string().optional().describe("日期,格式 YYYY-MM-DD,默认为当天"),
    time: z.string().optional().describe("时间,格式 HH:MM:SS,默认为当前时间"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    recordId: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [AddExpenseRecord] 开始执行", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      const now = new Date();
      const date = context.date || now.toISOString().split('T')[0];
      const time = context.time || now.toTimeString().split(' ')[0];
      const timestamp = `${date} ${time}`;
      
      const values = [[
        timestamp,
        "支出",
        context.amount,
        context.currency,
        context.category || "",
        context.description || "",
      ]];
      
      logger?.info("📝 [AddExpenseRecord] 准备写入数据", values);
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "支出!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      
      logger?.info("✅ [AddExpenseRecord] 成功记录支出");
      
      return {
        success: true,
        message: `成功记录支出: ${context.amount} ${context.currency}`,
        recordId: timestamp,
      };
    } catch (error: any) {
      logger?.error("❌ [AddExpenseRecord] 记录支出失败", { error: error.message });
      return {
        success: false,
        message: `记录支出失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Delete Record
 * Deletes a record from Google Sheets by timestamp
 */
export const deleteRecord = createTool({
  id: "delete-record",
  description: "从 Google Sheets 删除指定的账单记录",
  
  inputSchema: z.object({
    sheetName: z.string().describe("工作表名称,如 '收入' 或 '支出'"),
    recordId: z.string().describe("记录的时间戳标识"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [DeleteRecord] 开始执行", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      // 先读取所有数据找到要删除的行
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${context.sheetName}!A:A`,
      });
      
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === context.recordId);
      
      if (rowIndex === -1) {
        logger?.warn("⚠️ [DeleteRecord] 未找到记录", { recordId: context.recordId });
        return {
          success: false,
          message: "未找到指定的记录",
        };
      }
      
      // 获取工作表 ID
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      
      const sheet = sheetMetadata.data.sheets?.find(
        s => s.properties?.title === context.sheetName
      );
      
      if (!sheet || !sheet.properties?.sheetId) {
        throw new Error("未找到工作表");
      }
      
      // 删除行
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          }],
        },
      });
      
      logger?.info("✅ [DeleteRecord] 成功删除记录");
      
      return {
        success: true,
        message: "成功删除记录",
      };
    } catch (error: any) {
      logger?.error("❌ [DeleteRecord] 删除记录失败", { error: error.message });
      return {
        success: false,
        message: `删除记录失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Get Daily Summary
 * Retrieves and calculates daily summary of income and expenses
 */
export const getDailySummary = createTool({
  id: "get-daily-summary",
  description: "获取指定日期的收支汇总,计算总收入、总支出和净收入",
  
  inputSchema: z.object({
    date: z.string().optional().describe("日期,格式 YYYY-MM-DD,默认为当天"),
    incomeFeeRate: z.number().default(0).describe("收入费率,默认为 0"),
    expenseFeeRate: z.number().default(0).describe("支出费率,默认为 0"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    date: z.string(),
    totalIncome: z.number(),
    totalExpense: z.number(),
    incomeFee: z.number(),
    expenseFee: z.number(),
    netIncome: z.number(),
    summary: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [GetDailySummary] 开始执行", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      const targetDate = context.date || new Date().toISOString().split('T')[0];
      
      // 读取收入数据
      const incomeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "收入!A:C",
      });
      
      const incomeRows = incomeResponse.data.values || [];
      const dailyIncome = incomeRows
        .filter(row => row[0] && row[0].startsWith(targetDate))
        .reduce((sum, row) => sum + (parseFloat(row[2]) || 0), 0);
      
      // 读取支出数据
      const expenseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "支出!A:C",
      });
      
      const expenseRows = expenseResponse.data.values || [];
      const dailyExpense = expenseRows
        .filter(row => row[0] && row[0].startsWith(targetDate))
        .reduce((sum, row) => sum + (parseFloat(row[2]) || 0), 0);
      
      // 计算费用
      const incomeFee = dailyIncome * context.incomeFeeRate;
      const expenseFee = dailyExpense * context.expenseFeeRate;
      
      // 计算净收入: (总收入 - 费率) - (总支出 - 费率)
      const netIncome = (dailyIncome - incomeFee) - (dailyExpense - expenseFee);
      
      const summary = `
📅 日期: ${targetDate}
💰 总收入: ${dailyIncome.toFixed(2)}
💸 总支出: ${dailyExpense.toFixed(2)}
📊 收入费用: ${incomeFee.toFixed(2)}
📊 支出费用: ${expenseFee.toFixed(2)}
✨ 净收入: ${netIncome.toFixed(2)}
`;
      
      logger?.info("✅ [GetDailySummary] 成功获取日汇总", {
        totalIncome: dailyIncome,
        totalExpense: dailyExpense,
        netIncome,
      });
      
      return {
        success: true,
        date: targetDate,
        totalIncome: dailyIncome,
        totalExpense: dailyExpense,
        incomeFee,
        expenseFee,
        netIncome,
        summary,
      };
    } catch (error: any) {
      logger?.error("❌ [GetDailySummary] 获取日汇总失败", { error: error.message });
      return {
        success: false,
        date: context.date || "",
        totalIncome: 0,
        totalExpense: 0,
        incomeFee: 0,
        expenseFee: 0,
        netIncome: 0,
        summary: `获取日汇总失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Update Settings
 * Updates bot settings like fee rates and settlement times
 */
export const updateSettings = createTool({
  id: "update-settings",
  description: "更新记账机器人的设置,包括费率、结算时间等",
  
  inputSchema: z.object({
    incomeFeeRate: z.number().optional().describe("收入费率(百分比)"),
    expenseFeeRate: z.number().optional().describe("支出费率(百分比)"),
    settlementTime: z.string().optional().describe("每日结算时间,格式 HH:MM"),
    startTime: z.string().optional().describe("每日记账开始时间,格式 HH:MM"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [UpdateSettings] 开始执行", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      const updates: string[] = [];
      
      // 准备更新数据
      const settingsData: any[] = [["设置项", "值"]];
      
      if (context.incomeFeeRate !== undefined) {
        settingsData.push(["收入费率", context.incomeFeeRate]);
        updates.push(`收入费率: ${context.incomeFeeRate}%`);
      }
      
      if (context.expenseFeeRate !== undefined) {
        settingsData.push(["支出费率", context.expenseFeeRate]);
        updates.push(`支出费率: ${context.expenseFeeRate}%`);
      }
      
      if (context.settlementTime) {
        settingsData.push(["结算时间", context.settlementTime]);
        updates.push(`结算时间: ${context.settlementTime}`);
      }
      
      if (context.startTime) {
        settingsData.push(["记账开始时间", context.startTime]);
        updates.push(`记账开始时间: ${context.startTime}`);
      }
      
      // 写入设置
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "设置!A1:B" + settingsData.length,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: settingsData },
      });
      
      logger?.info("✅ [UpdateSettings] 成功更新设置");
      
      return {
        success: true,
        message: `成功更新设置:\n${updates.join('\n')}`,
      };
    } catch (error: any) {
      logger?.error("❌ [UpdateSettings] 更新设置失败", { error: error.message });
      return {
        success: false,
        message: `更新设置失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Get Settings
 * Retrieves current bot settings
 */
export const getSettings = createTool({
  id: "get-settings",
  description: "获取当前的记账机器人设置",
  
  inputSchema: z.object({}),
  
  outputSchema: z.object({
    success: z.boolean(),
    incomeFeeRate: z.number(),
    expenseFeeRate: z.number(),
    settlementTime: z.string(),
    startTime: z.string(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [GetSettings] 开始执行", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "设置!A:B",
      });
      
      const rows = response.data.values || [];
      const settings: any = {
        incomeFeeRate: 0,
        expenseFeeRate: 0,
        settlementTime: "23:59",
        startTime: "00:00",
      };
      
      rows.forEach(row => {
        if (row[0] === "收入费率") settings.incomeFeeRate = parseFloat(row[1]) || 0;
        if (row[0] === "支出费率") settings.expenseFeeRate = parseFloat(row[1]) || 0;
        if (row[0] === "结算时间") settings.settlementTime = row[1] || "23:59";
        if (row[0] === "记账开始时间") settings.startTime = row[1] || "00:00";
      });
      
      logger?.info("✅ [GetSettings] 成功获取设置", settings);
      
      return {
        success: true,
        ...settings,
        message: `当前设置:\n收入费率: ${settings.incomeFeeRate}%\n支出费率: ${settings.expenseFeeRate}%\n记账开始时间: ${settings.startTime}\n结算时间: ${settings.settlementTime}`,
      };
    } catch (error: any) {
      logger?.error("❌ [GetSettings] 获取设置失败", { error: error.message });
      return {
        success: false,
        incomeFeeRate: 0,
        expenseFeeRate: 0,
        settlementTime: "23:59",
        startTime: "00:00",
        message: `获取设置失败: ${error.message}`,
      };
    }
  },
});
