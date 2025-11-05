import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUncachableGoogleSheetClient } from "../../integrations/googleSheets";

// ============= 入款/下发记录工具 =============

/**
 * Tool: Add Income Record
 * 添加入款记录 (+1000 或 +1000$)
 */
export const addIncomeRecord = createTool({
  id: "add-income-record",
  description: "添加入款记录,格式: +1000 (泰铢฿) 或 +1000$ (美元$)",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().describe("用户ID"),
    username: z.string().describe("用户名"),
    amount: z.number().describe("入款金额"),
    currency: z.string().default("THB").describe("币种: THB(泰铢) 或 USD(美元)"),
    messageId: z.string().optional().describe("Telegram 消息ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    recordId: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [AddIncomeRecord] 添加入款记录", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
      const recordId = `INC_${Date.now()}`;
      
      const values = [[
        recordId,
        timestamp,
        context.groupId,
        context.userId,
        context.username,
        context.amount,
        context.currency,
        "正常",
        context.messageId || "",
      ]];
      
      logger?.info("📝 [AddIncomeRecord] 写入入款数据", values);
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Deposits!A:I",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      
      logger?.info("✅ [AddIncomeRecord] 入款记录成功");
      
      const symbol = context.currency === "USD" ? "$" : "฿";
      return {
        success: true,
        message: `✅ 入款成功: +${symbol}${context.amount}`,
        recordId,
      };
    } catch (error: any) {
      logger?.error("❌ [AddIncomeRecord] 添加失败", error);
      return {
        success: false,
        message: `❌ 入款失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Add Outgoing Record
 * 添加下发记录 (下发1000 或 下发1000$)
 */
export const addOutgoingRecord = createTool({
  id: "add-outgoing-record",
  description: "添加下发记录,格式: 下发1000 (泰铢฿) 或 下发1000$ (美元$)",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().describe("用户ID"),
    username: z.string().describe("用户名"),
    amount: z.number().describe("下发金额"),
    currency: z.string().default("THB").describe("币种: THB(泰铢) 或 USD(美元)"),
    messageId: z.string().optional().describe("Telegram 消息ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    recordId: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [AddOutgoingRecord] 添加下发记录", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
      const recordId = `OUT_${Date.now()}`;
      
      const values = [[
        recordId,
        timestamp,
        context.groupId,
        context.userId,
        context.username,
        context.amount,
        context.currency,
        "正常",
        context.messageId || "",
      ]];
      
      logger?.info("📝 [AddOutgoingRecord] 写入下发数据", values);
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Withdrawals!A:I",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      
      logger?.info("✅ [AddOutgoingRecord] 下发记录成功");
      
      const symbol = context.currency === "USD" ? "$" : "฿";
      return {
        success: true,
        message: `✅ 下发成功: -${symbol}${context.amount}`,
        recordId,
      };
    } catch (error: any) {
      logger?.error("❌ [AddOutgoingRecord] 添加失败", error);
      return {
        success: false,
        message: `❌ 下发失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Revoke Last Income
 * 撤销最近一条入款记录
 */
export const revokeLastIncome = createTool({
  id: "revoke-last-income",
  description: "撤销最近一条入款记录",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().optional().describe("用户ID,如果提供则只撤销该用户的记录"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [RevokeLastIncome] 撤销入款", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Deposits!A:I",
      });
      
      const rows = response.data.values || [];
      let lastIndex = -1;
      
      // 从后往前找最近的正常记录
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][2] === context.groupId && rows[i][7] === "正常") {
          if (!context.userId || rows[i][3] === context.userId) {
            lastIndex = i;
            break;
          }
        }
      }
      
      if (lastIndex === -1) {
        return {
          success: false,
          message: "❌ 没有找到可撤销的入款记录",
        };
      }
      
      // 标记为已撤销
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Deposits!H${lastIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [["已撤销"]],
        },
      });
      
      const amount = rows[lastIndex][5];
      const currency = rows[lastIndex][6];
      const symbol = currency === "USD" ? "$" : "฿";
      
      logger?.info("✅ [RevokeLastIncome] 撤销成功");
      
      return {
        success: true,
        message: `✅ 已撤销入款: ${symbol}${amount}`,
      };
    } catch (error: any) {
      logger?.error("❌ [RevokeLastIncome] 撤销失败", error);
      return {
        success: false,
        message: `❌ 撤销失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Revoke Last Outgoing
 * 撤销最近一条下发记录
 */
export const revokeLastOutgoing = createTool({
  id: "revoke-last-outgoing",
  description: "撤销最近一条下发记录",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().optional().describe("用户ID,如果提供则只撤销该用户的记录"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [RevokeLastOutgoing] 撤销下发", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const rows = response.data.values || [];
      let lastIndex = -1;
      
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][2] === context.groupId && rows[i][7] === "正常") {
          if (!context.userId || rows[i][3] === context.userId) {
            lastIndex = i;
            break;
          }
        }
      }
      
      if (lastIndex === -1) {
        return {
          success: false,
          message: "❌ 没有找到可撤销的下发记录",
        };
      }
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Withdrawals!H${lastIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [["已撤销"]],
        },
      });
      
      const amount = rows[lastIndex][5];
      const currency = rows[lastIndex][6];
      const symbol = currency === "USD" ? "$" : "฿";
      
      logger?.info("✅ [RevokeLastOutgoing] 撤销成功");
      
      return {
        success: true,
        message: `✅ 已撤销下发: ${symbol}${amount}`,
      };
    } catch (error: any) {
      logger?.error("❌ [RevokeLastOutgoing] 撤销失败", error);
      return {
        success: false,
        message: `❌ 撤销失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Modify Record Amount
 * 修改账单金额（通过引用消息）
 */
export const modifyRecordAmount = createTool({
  id: "modify-record-amount",
  description: "修改指定记录的金额,通过引用消息+修改命令",
  
  inputSchema: z.object({
    messageId: z.string().describe("原始消息ID"),
    newAmount: z.number().describe("新的金额"),
    groupId: z.string().describe("群组ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ModifyRecordAmount] 修改记录金额", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      // 先在入款记录中查找
      const incomeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Deposits!A:I",
      });
      
      const incomeRows = incomeResponse.data.values || [];
      for (let i = 1; i < incomeRows.length; i++) {
        if (incomeRows[i][8] === context.messageId && incomeRows[i][2] === context.groupId) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Deposits!F${i + 1}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [[context.newAmount]],
            },
          });
          
          logger?.info("✅ [ModifyRecordAmount] 入款记录修改成功");
          return {
            success: true,
            message: `✅ 已修改入款金额为: ${context.newAmount}`,
          };
        }
      }
      
      // 再在下发记录中查找
      const outgoingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const outgoingRows = outgoingResponse.data.values || [];
      for (let i = 1; i < outgoingRows.length; i++) {
        if (outgoingRows[i][8] === context.messageId && outgoingRows[i][2] === context.groupId) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Withdrawals!F${i + 1}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [[context.newAmount]],
            },
          });
          
          logger?.info("✅ [ModifyRecordAmount] 下发记录修改成功");
          return {
            success: true,
            message: `✅ 已修改下发金额为: ${context.newAmount}`,
          };
        }
      }
      
      return {
        success: false,
        message: "❌ 没有找到对应的记录",
      };
    } catch (error: any) {
      logger?.error("❌ [ModifyRecordAmount] 修改失败", error);
      return {
        success: false,
        message: `❌ 修改失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Delete All Records
 * 删除所有账单记录
 */
export const deleteAllRecords = createTool({
  id: "delete-all-records",
  description: "删除指定群组的所有账单记录",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    incomeDeleted: z.number(),
    outgoingDeleted: z.number(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [DeleteAllRecords] 删除所有记录", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      let incomeCount = 0;
      let outgoingCount = 0;
      
      // 删除入款记录
      const incomeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Deposits!A:I",
      });
      
      const incomeRows = incomeResponse.data.values || [];
      for (let i = 1; i < incomeRows.length; i++) {
        if (incomeRows[i][2] === context.groupId && incomeRows[i][7] === "正常") {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Deposits!H${i + 1}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [["已删除"]],
            },
          });
          incomeCount++;
        }
      }
      
      // 删除下发记录
      const outgoingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Withdrawals!A:I",
      });
      
      const outgoingRows = outgoingResponse.data.values || [];
      for (let i = 1; i < outgoingRows.length; i++) {
        if (outgoingRows[i][2] === context.groupId && outgoingRows[i][7] === "正常") {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Withdrawals!H${i + 1}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [["已删除"]],
            },
          });
          outgoingCount++;
        }
      }
      
      logger?.info(`✅ [DeleteAllRecords] 删除完成: 入款${incomeCount}条, 下发${outgoingCount}条`);
      
      return {
        success: true,
        message: `✅ 已删除所有账单\n入款: ${incomeCount}条\n下发: ${outgoingCount}条`,
        incomeDeleted: incomeCount,
        outgoingDeleted: outgoingCount,
      };
    } catch (error: any) {
      logger?.error("❌ [DeleteAllRecords] 删除失败", error);
      return {
        success: false,
        message: `❌ 删除失败: ${error.message}`,
        incomeDeleted: 0,
        outgoingDeleted: 0,
      };
    }
  },
});
