import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUncachableGoogleSheetClient } from "../../integrations/googleSheets";

// 获取今天的日期字符串（YYYY-MM-DD格式）
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============= 账单查询工具 =============

/**
 * Tool: Show All Bills
 * 显示群里所有人的账单
 */
export const showAllBills = createTool({
  id: "show-all-bills",
  description: "显示群组账单汇总，默认显示前3笔入款和出款",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    showAll: z.boolean().default(false).describe("是否显示所有记录（true=结算模式，false=默认显示前3笔）"),
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
    logger?.info("🔧 [ShowAllBills] 显示账单", { groupId: context.groupId, showAll: context.showAll });
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      // 获取群组设置（费率）
      const settingsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:D",
      });
      
      const settingsRows = settingsResponse.data.values || [];
      let incomeFeeRate = 6; // 默认入款费率6%
      let outgoingFeeRate = 0; // 默认出款费率0%
      
      for (let i = 1; i < settingsRows.length; i++) {
        if (settingsRows[i][0] === context.groupId) {
          incomeFeeRate = parseFloat(settingsRows[i][2] || "6");
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
      let totalIncome = 0;
      const incomeRecords: Array<{time: string, amount: number}> = [];
      
      for (let i = 1; i < incomeRows.length; i++) {
        if (incomeRows[i][2] === context.groupId && incomeRows[i][7] === "正常") {
          const amount = parseFloat(incomeRows[i][5]);
          const timestamp = incomeRows[i][1] || "";
          
          // 提取时间部分 (HH:MM:SS)
          const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : timestamp;
          
          incomeRecords.push({ time, amount });
          totalIncome += amount;
        }
      }
      
      // 获取出款记录
      const outgoingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const outgoingRows = outgoingResponse.data.values || [];
      let totalOutgoing = 0;
      const outgoingRecords: Array<{time: string, amount: number}> = [];
      
      for (let i = 1; i < outgoingRows.length; i++) {
        if (outgoingRows[i][2] === context.groupId && outgoingRows[i][7] === "正常") {
          const amount = parseFloat(outgoingRows[i][5]);
          const timestamp = outgoingRows[i][1] || "";
          
          // 提取时间部分 (HH:MM:SS)
          const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : timestamp;
          
          outgoingRecords.push({ time, amount });
          totalOutgoing += amount;
        }
      }
      
      // 计算费率后的金额
      const feeMultiplier = (100 - incomeFeeRate) / 100; // 例如6%费率 -> 0.94
      const actualIncome = totalIncome * feeMultiplier;
      const actualOutgoing = totalOutgoing * (1 + outgoingFeeRate / 100);
      const netProfit = actualIncome - actualOutgoing;
      
      // 构建消息
      let message = `入款`;
      
      // 显示入款记录
      if (incomeRecords.length === 0) {
        message += `（0笔）：\n`;
      } else {
        const displayRecords = context.showAll ? incomeRecords : incomeRecords.slice(-3);
        message += `（${incomeRecords.length}笔）：\n`;
        
        for (const record of displayRecords) {
          const actualAmount = record.amount * feeMultiplier;
          message += ` ${record.time} ${record.amount.toFixed(0)} ×${feeMultiplier.toFixed(2)}=${actualAmount.toFixed(0)}\n`;
        }
        
        // 如果只显示前3笔但总数大于3，添加提示
        if (!context.showAll && incomeRecords.length > 3) {
          message += ` （仅显示最近3笔）\n`;
        }
      }
      
      // 显示出款记录
      message += `\n下发`;
      if (outgoingRecords.length === 0) {
        message += `（0笔）：\n`;
      } else {
        const displayRecords = context.showAll ? outgoingRecords : outgoingRecords.slice(-3);
        message += `（${outgoingRecords.length}笔）：\n`;
        
        for (const record of displayRecords) {
          const actualAmount = record.amount * (1 + outgoingFeeRate / 100);
          const feeMultiplierOut = 1 + outgoingFeeRate / 100;
          message += ` ${record.time} ${record.amount.toFixed(0)} ×${feeMultiplierOut.toFixed(2)}=${actualAmount.toFixed(0)}\n`;
        }
        
        // 如果只显示前3笔但总数大于3，添加提示
        if (!context.showAll && outgoingRecords.length > 3) {
          message += ` （仅显示最近3笔）\n`;
        }
      }
      
      // 总入款和费率（加粗显示）
      message += `\n\n*总入款：${totalIncome.toFixed(0)}*`;
      message += `\n入款费率：${incomeFeeRate.toFixed(0)}%`;
      if (outgoingFeeRate > 0) {
        message += `\n出款费率：${outgoingFeeRate.toFixed(0)}%`;
      }
      
      // 总下发和净利润（加粗显示关键数据）
      message += `\n\n*总入款扣费后：${actualIncome.toFixed(2)}*`;
      if (totalOutgoing > 0) {
        message += `\n*总下发：${actualOutgoing.toFixed(2)}*`;
      }
      message += `\n*净利润：${netProfit.toFixed(2)}*`;
      
      logger?.info("✅ [ShowAllBills] 查询成功");
      
      return {
        success: true,
        message,
        totalIncome,
        totalOutgoing,
        netProfit,
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

/**
 * Tool: Daily Settlement
 * 每日0点自动结算并清空当天账单
 */
export const dailySettlement = createTool({
  id: "daily-settlement",
  description: "每日自动结算，生成报告并标记当天账单为已结算",
  
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
    logger?.info("🔧 [DailySettlement] 开始每日结算", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      const today = getTodayDateString();
      
      // 获取群组设置（费率）
      const settingsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:D",
      });
      
      const settingsRows = settingsResponse.data.values || [];
      let incomeFeeRate = 6;
      let outgoingFeeRate = 0;
      
      for (let i = 1; i < settingsRows.length; i++) {
        if (settingsRows[i][0] === context.groupId) {
          incomeFeeRate = parseFloat(settingsRows[i][2] || "6");
          outgoingFeeRate = parseFloat(settingsRows[i][3] || "0");
          break;
        }
      }
      
      // 获取今天的入款记录
      const incomeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Deposits!A:I",
      });
      
      const incomeRows = incomeResponse.data.values || [];
      let totalIncome = 0;
      let incomeCount = 0;
      const incomeRecords: Array<{time: string, amount: number, rowIndex: number}> = [];
      
      for (let i = 1; i < incomeRows.length; i++) {
        const timestamp = incomeRows[i][1] || "";
        const recordDate = timestamp.split(' ')[0]; // 获取日期部分
        
        if (incomeRows[i][2] === context.groupId && 
            incomeRows[i][7] === "正常" && 
            recordDate === today) {
          const amount = parseFloat(incomeRows[i][5]);
          const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : timestamp;
          
          incomeRecords.push({ time, amount, rowIndex: i });
          totalIncome += amount;
          incomeCount++;
        }
      }
      
      // 获取今天的出款记录
      const outgoingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const outgoingRows = outgoingResponse.data.values || [];
      let totalOutgoing = 0;
      let outgoingCount = 0;
      const outgoingRecords: Array<{time: string, amount: number, rowIndex: number}> = [];
      
      for (let i = 1; i < outgoingRows.length; i++) {
        const timestamp = outgoingRows[i][1] || "";
        const recordDate = timestamp.split(' ')[0];
        
        if (outgoingRows[i][2] === context.groupId && 
            outgoingRows[i][7] === "正常" && 
            recordDate === today) {
          const amount = parseFloat(outgoingRows[i][5]);
          const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : timestamp;
          
          outgoingRecords.push({ time, amount, rowIndex: i });
          totalOutgoing += amount;
          outgoingCount++;
        }
      }
      
      // 计算费率后的金额
      const feeMultiplier = (100 - incomeFeeRate) / 100;
      const actualIncome = totalIncome * feeMultiplier;
      const actualOutgoing = totalOutgoing * (1 + outgoingFeeRate / 100);
      const netProfit = actualIncome - actualOutgoing;
      
      // 生成结算报告
      let message = `📊 ${today} 每日结算报告\n\n`;
      
      // 显示入款记录
      message += `入款（${incomeCount}笔）：\n`;
      if (incomeCount === 0) {
        message += `无记录\n`;
      } else {
        for (const record of incomeRecords) {
          const actualAmount = record.amount * feeMultiplier;
          message += `${record.time} ${record.amount.toFixed(0)} ×${feeMultiplier.toFixed(2)}=${actualAmount.toFixed(0)}\n`;
        }
      }
      
      // 显示出款记录
      message += `\n下发（${outgoingCount}笔）：\n`;
      if (outgoingCount === 0) {
        message += `无记录\n`;
      } else {
        for (const record of outgoingRecords) {
          const actualAmount = record.amount * (1 + outgoingFeeRate / 100);
          message += `${record.time} ${record.amount.toFixed(0)} ×${(1 + outgoingFeeRate / 100).toFixed(2)}=${actualAmount.toFixed(0)}\n`;
        }
      }
      
      // 汇总信息
      message += `\n总入款：${totalIncome.toFixed(0)}\n`;
      message += `入款费率：${incomeFeeRate}%\n`;
      message += `入款扣费：${actualIncome.toFixed(2)}\n`;
      message += `总下发：${totalOutgoing.toFixed(2)}\n`;
      message += `下发费率：${outgoingFeeRate}%\n`;
      message += `净利润：${netProfit.toFixed(2)}\n`;
      message += `\n✅ 今日账单已结算并归档`;
      
      // 标记今天的账单为"已结算"（不删除）
      for (const record of incomeRecords) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Deposits!H${record.rowIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["已结算"]],
          },
        });
      }
      
      for (const record of outgoingRecords) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Withdrawals!H${record.rowIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["已结算"]],
          },
        });
      }
      
      logger?.info(`✅ [DailySettlement] 结算完成: 入款${incomeCount}条, 出款${outgoingCount}条`);
      
      return {
        success: true,
        message,
        totalIncome,
        totalOutgoing,
        netProfit,
      };
    } catch (error: any) {
      logger?.error("❌ [DailySettlement] 结算失败", error);
      return {
        success: false,
        message: `❌ 每日结算失败: ${error.message}`,
        totalIncome: 0,
        totalOutgoing: 0,
        netProfit: 0,
      };
    }
  },
});
