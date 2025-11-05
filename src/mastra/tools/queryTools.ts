import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUncachableGoogleSheetClient } from "../../integrations/googleSheets";

// ============= 账单查询工具 =============

/**
 * Tool: Show All Bills
 * 显示群里所有人的账单
 */
export const showAllBills = createTool({
  id: "show-all-bills",
  description: "显示群组所有人的账单汇总",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    totalIncome: z.number(),
    totalOutgoing: z.number(),
    netProfit: z.number(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ShowAllBills] 显示所有账单", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      // 获取群组设置
      const settingsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:I",
      });
      
      const settingsRows = settingsResponse.data.values || [];
      let exchangeRate = 35; // THB/USD 默认汇率
      let incomeFeeRate = 5;
      let outgoingFeeRate = 0;
      
      for (let i = 1; i < settingsRows.length; i++) {
        if (settingsRows[i][0] === context.groupId) {
          exchangeRate = parseFloat(settingsRows[i][1] || "35");
          incomeFeeRate = parseFloat(settingsRows[i][2] || "5");
          outgoingFeeRate = parseFloat(settingsRows[i][3] || "0");
          break;
        }
      }
      
      // 获取入款记录
      const incomeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Deposits!A:I",
      });
      
      const incomeRows = incomeResponse.data.values || [];
      let totalIncomeTHB = 0;
      let totalIncomeUSD = 0;
      const incomeRecords: Array<{time: string, amount: number, currency: string}> = [];
      
      for (let i = 1; i < incomeRows.length; i++) {
        if (incomeRows[i][2] === context.groupId && incomeRows[i][7] === "正常") {
          const timestamp = incomeRows[i][1] || "";
          const amount = parseFloat(incomeRows[i][5]);
          const currency = incomeRows[i][6];
          
          // 提取时间部分 (HH:MM:SS)
          const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : timestamp;
          
          incomeRecords.push({ time, amount, currency });
          
          if (currency === "THB") {
            totalIncomeTHB += amount;
          } else {
            totalIncomeUSD += amount;
          }
        }
      }
      
      // 获取下发记录
      const outgoingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const outgoingRows = outgoingResponse.data.values || [];
      let totalOutgoingTHB = 0;
      let totalOutgoingUSD = 0;
      const outgoingRecords: Array<{time: string, amount: number, currency: string}> = [];
      
      for (let i = 1; i < outgoingRows.length; i++) {
        if (outgoingRows[i][2] === context.groupId && outgoingRows[i][7] === "正常") {
          const timestamp = outgoingRows[i][1] || "";
          const amount = parseFloat(outgoingRows[i][5]);
          const currency = outgoingRows[i][6];
          
          // 提取时间部分 (HH:MM:SS)
          const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : timestamp;
          
          outgoingRecords.push({ time, amount, currency });
          
          if (currency === "THB") {
            totalOutgoingTHB += amount;
          } else {
            totalOutgoingUSD += amount;
          }
        }
      }
      
      // 计算总额(转换为THB)
      const totalIncome = totalIncomeTHB + (totalIncomeUSD * exchangeRate);
      const totalOutgoing = totalOutgoingTHB + (totalOutgoingUSD * exchangeRate);
      
      // 应用费率（入款和下发使用不同的费率）
      const actualIncome = totalIncome * (1 - incomeFeeRate / 100);
      const actualOutgoing = totalOutgoing * (1 + outgoingFeeRate / 100);
      const balance = actualIncome - actualOutgoing;
      
      // 构建消息 - 按照用户提供的模板格式
      let message = `TOM记账机器人测试\n\n`;
      message += `入款(฿):\n`;
      
      // 显示入款记录
      if (incomeRecords.length === 0) {
        message += `0\n`;
      } else {
        for (const record of incomeRecords) {
          const amountInUSD = record.amount / exchangeRate;
          message += `${record.time} ${record.amount.toFixed(2)} / ${exchangeRate.toFixed(2)}= ${amountInUSD.toFixed(2)}U\n`;
        }
      }
      
      message += `\n下发(฿):`;
      
      // 显示下发记录
      if (outgoingRecords.length === 0) {
        message += `0\n`;
      } else {
        message += `\n`;
        for (const record of outgoingRecords) {
          const amountInUSD = record.amount / exchangeRate;
          message += `${record.time} ${record.amount.toFixed(2)} / ${exchangeRate.toFixed(2)}= ${amountInUSD.toFixed(2)}U\n`;
        }
      }
      
      // 总入款和费率
      message += `\n总入款: ${totalIncome.toFixed(2)}\n`;
      message += `入款费率: ${incomeFeeRate.toFixed(1)}%\n`;
      message += `下发费率: ${outgoingFeeRate.toFixed(1)}%\n`;
      
      // 汇率和计算结果
      message += `\nUSDT汇率: ${exchangeRate.toFixed(2)}\n`;
      message += `应下发: ${actualIncome.toFixed(2)}   | ${(actualIncome / exchangeRate).toFixed(2)} USDT\n`;
      message += `总下发: ${actualOutgoing.toFixed(4)} | ${(actualOutgoing / exchangeRate).toFixed(4)} USDT\n`;
      message += `余: ${balance.toFixed(2)} | ${(balance / exchangeRate).toFixed(2)} USDT`;
      
      logger?.info("✅ [ShowAllBills] 查询成功");
      
      return {
        success: true,
        message,
        totalIncome,
        totalOutgoing,
        netProfit: balance,
      };
    } catch (error: any) {
      logger?.error("❌ [ShowAllBills] 查询失败", error);
      return {
        success: false,
        message: `❌ 查询失败: ${error.message}`,
        totalIncome: 0,
        totalOutgoing: 0,
        netProfit: 0,
      };
    }
  },
});

/**
 * Tool: Show User Bills
 * 显示个人账单 (/我命令)
 */
export const showUserBills = createTool({
  id: "show-user-bills",
  description: "显示指定用户的个人账单,命令: /我",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().describe("用户ID"),
    username: z.string().describe("用户名"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ShowUserBills] 显示个人账单", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      // 获取入款记录
      const incomeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Deposits!A:I",
      });
      
      const incomeRows = incomeResponse.data.values || [];
      let incomeTHB = 0;
      let incomeUSD = 0;
      const incomeRecords: string[] = [];
      
      for (let i = 1; i < incomeRows.length; i++) {
        if (incomeRows[i][2] === context.groupId && 
            incomeRows[i][3] === context.userId && 
            incomeRows[i][7] === "正常") {
          const amount = parseFloat(incomeRows[i][5]);
          const currency = incomeRows[i][6];
          const time = incomeRows[i][1];
          const symbol = currency === "USD" ? "$" : "฿";
          
          if (currency === "THB") {
            incomeTHB += amount;
          } else {
            incomeUSD += amount;
          }
          
          incomeRecords.push(`  ${time}: +${symbol}${amount}`);
        }
      }
      
      // 获取下发记录
      const outgoingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const outgoingRows = outgoingResponse.data.values || [];
      let outgoingTHB = 0;
      let outgoingUSD = 0;
      const outgoingRecords: string[] = [];
      
      for (let i = 1; i < outgoingRows.length; i++) {
        if (outgoingRows[i][2] === context.groupId && 
            outgoingRows[i][3] === context.userId && 
            outgoingRows[i][7] === "正常") {
          const amount = parseFloat(outgoingRows[i][5]);
          const currency = outgoingRows[i][6];
          const time = outgoingRows[i][1];
          const symbol = currency === "USD" ? "$" : "฿";
          
          if (currency === "THB") {
            outgoingTHB += amount;
          } else {
            outgoingUSD += amount;
          }
          
          outgoingRecords.push(`  ${time}: -${symbol}${amount}`);
        }
      }
      
      let message = `📊 ${context.username} 的账单\n\n`;
      message += `💰 入款记录:\n`;
      if (incomeRecords.length > 0) {
        message += incomeRecords.slice(-5).join('\n') + '\n';
      }
      message += `  总计: ฿${incomeTHB.toFixed(2)} | $${incomeUSD.toFixed(2)}\n\n`;
      message += `💸 下发记录:\n`;
      if (outgoingRecords.length > 0) {
        message += outgoingRecords.slice(-5).join('\n') + '\n';
      }
      message += `  总计: ฿${outgoingTHB.toFixed(2)} | $${outgoingUSD.toFixed(2)}`;
      
      logger?.info("✅ [ShowUserBills] 查询成功");
      
      return {
        success: true,
        message,
      };
    } catch (error: any) {
      logger?.error("❌ [ShowUserBills] 查询失败", error);
      return {
        success: false,
        message: `❌ 查询失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Show Detailed Records
 * 显示单笔明细 (+命令)
 */
export const showDetailedRecords = createTool({
  id: "show-detailed-records",
  description: "显示所有单笔交易明细,命令: +",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    limit: z.number().default(20).describe("显示最近多少条记录"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ShowDetailedRecords] 显示明细", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const records: Array<{time: string, type: string, user: string, amount: number, currency: string}> = [];
      
      // 获取入款记录
      const incomeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Deposits!A:I",
      });
      
      const incomeRows = incomeResponse.data.values || [];
      for (let i = 1; i < incomeRows.length; i++) {
        if (incomeRows[i][2] === context.groupId && incomeRows[i][7] === "正常") {
          records.push({
            time: incomeRows[i][1],
            type: "入款",
            user: incomeRows[i][4],
            amount: parseFloat(incomeRows[i][5]),
            currency: incomeRows[i][6],
          });
        }
      }
      
      // 获取下发记录
      const outgoingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const outgoingRows = outgoingResponse.data.values || [];
      for (let i = 1; i < outgoingRows.length; i++) {
        if (outgoingRows[i][2] === context.groupId && outgoingRows[i][7] === "正常") {
          records.push({
            time: outgoingRows[i][1],
            type: "下发",
            user: outgoingRows[i][4],
            amount: parseFloat(outgoingRows[i][5]),
            currency: outgoingRows[i][6],
          });
        }
      }
      
      // 按时间排序
      records.sort((a, b) => b.time.localeCompare(a.time));
      
      // 取最近的记录
      const recentRecords = records.slice(0, context.limit);
      
      let message = `📋 交易明细 (最近${recentRecords.length}条)\n\n`;
      
      recentRecords.forEach((record, index) => {
        const sign = record.type === "入款" ? "+" : "-";
        const symbol = record.currency === "USD" ? "$" : "฿";
        message += `${index + 1}. [${record.type}] ${record.user}\n`;
        message += `   ${sign}${symbol}${record.amount}\n`;
        message += `   ${record.time}\n\n`;
      });
      
      logger?.info("✅ [ShowDetailedRecords] 查询成功");
      
      return {
        success: true,
        message,
      };
    } catch (error: any) {
      logger?.error("❌ [ShowDetailedRecords] 查询失败", error);
      return {
        success: false,
        message: `❌ 查询失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Calculate Expression
 * 数学计算 (支持+-×÷)
 */
export const calculateExpression = createTool({
  id: "calculate-expression",
  description: "计算数学表达式,支持加减乘除",
  
  inputSchema: z.object({
    expression: z.string().describe("数学表达式,如: 100+200*3"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    result: z.number().optional(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [CalculateExpression] 计算表达式", context);
    
    try {
      // 安全地计算表达式
      const sanitized = context.expression.replace(/[^0-9+\-*/().×÷]/g, '');
      const normalized = sanitized.replace(/×/g, '*').replace(/÷/g, '/');
      
      // eslint-disable-next-line no-eval
      const result = eval(normalized);
      
      logger?.info("✅ [CalculateExpression] 计算成功", result);
      
      return {
        success: true,
        result,
        message: `🔢 ${context.expression} = ${result}`,
      };
    } catch (error: any) {
      logger?.error("❌ [CalculateExpression] 计算失败", error);
      return {
        success: false,
        message: `❌ 计算失败: 表达式格式错误`,
      };
    }
  },
});

/**
 * Tool: Set Daily Cutoff Time
 * 设置日切时间 (日切#6)
 */
export const setDailyCutoffTime = createTool({
  id: "set-daily-cutoff-time",
  description: "设置每日账单刷新时间,格式: 日切#6 (6点刷新), 日切#-1 (永不刷新)",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    hour: z.number().describe("小时数,0-23代表具体时间,-1代表永不刷新"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetDailyCutoffTime] 设置日切时间", context);
    
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
          range: `群组设置!D${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.hour]],
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
              context.hour,
              "否",
              "否",
              "",
              "否",
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetDailyCutoffTime] 设置成功");
      
      let message;
      if (context.hour === -1) {
        message = "✅ 已设置为永不自动刷新,只能手动删除账单";
      } else if (context.hour === 0) {
        message = "✅ 已设置日切时间为 0点 (晚上12点)";
      } else {
        message = `✅ 已设置日切时间为 ${context.hour}点`;
      }
      
      return {
        success: true,
        message,
      };
    } catch (error: any) {
      logger?.error("❌ [SetDailyCutoffTime] 设置失败", error);
      return {
        success: false,
        message: `❌ 设置失败: ${error.message}`,
      };
    }
  },
});
