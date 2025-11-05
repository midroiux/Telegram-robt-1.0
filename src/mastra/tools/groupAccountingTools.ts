import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUncachableGoogleSheetClient } from "../../integrations/googleSheets";

// ============= 操作人管理工具 =============

/**
 * Tool: Add Operator
 * 添加操作人到群组
 */
export const addOperator = createTool({
  id: "add-operator",
  description: "添加操作人到指定群组,格式: 设置操作人 @张三",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().describe("用户ID"),
    username: z.string().describe("用户名,如 @张三"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [AddOperator] 开始添加操作人", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
      
      const values = [[
        context.groupId,
        context.userId,
        context.username,
        timestamp,
        "正常",
      ]];
      
      logger?.info("📝 [AddOperator] 写入操作人数据", values);
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Operators!A:E",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      
      logger?.info("✅ [AddOperator] 操作人添加成功");
      
      return {
        success: true,
        message: `✅ 已添加操作人: ${context.username}`,
      };
    } catch (error: any) {
      logger?.error("❌ [AddOperator] 添加操作人失败", error);
      return {
        success: false,
        message: `❌ 添加操作人失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Remove Operator
 * 从群组删除操作人
 */
export const removeOperator = createTool({
  id: "remove-operator",
  description: "从群组删除操作人，使用用户ID精确匹配",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().describe("用户ID（数字ID更可靠）"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [RemoveOperator] 开始删除操作人", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      // 读取所有操作人
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Operators!A:E",
      });
      
      const rows = response.data.values || [];
      let foundIndex = -1;
      let foundUsername = "";
      
      // 使用用户ID查找（第2列：B列），更可靠
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId && rows[i][1] === context.userId && rows[i][4] === "正常") {
          foundIndex = i;
          foundUsername = rows[i][2] || "未知用户";
          break;
        }
      }
      
      if (foundIndex === -1) {
        return {
          success: false,
          message: `❌ 未找到该用户的操作人权限\n用户ID: ${context.userId}`,
        };
      }
      
      // 标记为已删除
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Operators!E${foundIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [["已删除"]],
        },
      });
      
      logger?.info("✅ [RemoveOperator] 操作人删除成功", {
        userId: context.userId,
        username: foundUsername,
      });
      
      return {
        success: true,
        message: `✅ 已移除操作人权限\n用户: ${foundUsername}`,
      };
    } catch (error: any) {
      logger?.error("❌ [RemoveOperator] 删除操作人失败", error);
      return {
        success: false,
        message: `❌ 删除操作人失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: List Operators
 * 显示群组所有操作人
 */
export const listOperators = createTool({
  id: "list-operators",
  description: "显示指定群组的所有操作人",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    operators: z.array(z.string()),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ListOperators] 开始查询操作人", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Operators!A:E",
      });
      
      const rows = response.data.values || [];
      const operators: string[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId && rows[i][4] === "正常") {
          operators.push(rows[i][2]);
        }
      }
      
      logger?.info("✅ [ListOperators] 查询成功", operators);
      
      return {
        success: true,
        operators,
        message: operators.length > 0 
          ? `当前操作人列表:\n${operators.join('\n')}`
          : "当前没有操作人",
      };
    } catch (error: any) {
      logger?.error("❌ [ListOperators] 查询失败", error);
      return {
        success: false,
        operators: [],
        message: `❌ 查询失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Set All Users Mode
 * 设置所有人都可以使用
 */
export const setAllUsersMode = createTool({
  id: "set-all-users-mode",
  description: "设置群组为所有人都可以使用记账功能",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    enabled: z.boolean().describe("是否启用所有人模式"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [SetAllUsersMode] 设置所有人模式", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      // 读取群组设置
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
        // 更新现有设置
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `群组设置!E${foundIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[context.enabled ? "是" : "否"]],
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
              35, // 默认汇率 THB/USD
              5,   // 默认费率
              6,   // 默认日切时间
              context.enabled ? "是" : "否",
              "否", // 默认不使用实时汇率
              "",   // 最后刷新时间
              "否", // 默认不禁言
            ]],
          },
        });
      }
      
      logger?.info("✅ [SetAllUsersMode] 设置成功");
      
      return {
        success: true,
        message: context.enabled ? "✅ 已设置为所有人可用" : "✅ 已关闭所有人模式",
      };
    } catch (error: any) {
      logger?.error("❌ [SetAllUsersMode] 设置失败", error);
      return {
        success: false,
        message: `❌ 设置失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Remove All Operators
 * 删除所有操作人
 */
export const removeAllOperators = createTool({
  id: "remove-all-operators",
  description: "删除指定群组的所有操作人",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [RemoveAllOperators] 删除所有操作人", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Operators!A:E",
      });
      
      const rows = response.data.values || [];
      let count = 0;
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === context.groupId && rows[i][4] === "正常") {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `操作人!E${i + 1}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [["已删除"]],
            },
          });
          count++;
        }
      }
      
      logger?.info(`✅ [RemoveAllOperators] 已删除${count}个操作人`);
      
      return {
        success: true,
        message: `✅ 已删除所有操作人 (共${count}人)`,
      };
    } catch (error: any) {
      logger?.error("❌ [RemoveAllOperators] 删除失败", error);
      return {
        success: false,
        message: `❌ 删除失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Check User Permission
 * 检查用户是否有操作权限
 */
export const checkUserPermission = createTool({
  id: "check-user-permission",
  description: "检查用户在指定群组是否有操作权限",
  
  inputSchema: z.object({
    groupId: z.string().describe("群组ID"),
    userId: z.string().describe("用户ID"),
  }),
  
  outputSchema: z.object({
    hasPermission: z.boolean(),
    reason: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [CheckUserPermission] 检查权限", context);
    
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_ID 环境变量未设置");
      }
      
      const sheets = await getUncachableGoogleSheetClient();
      
      // 检查是否开启所有人模式
      const settingsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "GroupSettings!A:J",
      });
      
      const settingsRows = settingsResponse.data.values || [];
      for (let i = 1; i < settingsRows.length; i++) {
        if (settingsRows[i][0] === context.groupId && settingsRows[i][4] === "是") {
          logger?.info("✅ [CheckUserPermission] 所有人模式,允许操作");
          return {
            hasPermission: true,
            reason: "所有人模式已开启",
          };
        }
      }
      
      // 检查是否在操作人列表中
      const operatorsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Operators!A:E",
      });
      
      const operatorRows = operatorsResponse.data.values || [];
      for (let i = 1; i < operatorRows.length; i++) {
        if (operatorRows[i][0] === context.groupId && 
            operatorRows[i][1] === context.userId && 
            operatorRows[i][4] === "正常") {
          logger?.info("✅ [CheckUserPermission] 是操作人,允许操作");
          return {
            hasPermission: true,
            reason: "用户在操作人列表中",
          };
        }
      }
      
      logger?.info("❌ [CheckUserPermission] 无权限");
      return {
        hasPermission: false,
        reason: "用户不在操作人列表中,且未开启所有人模式",
      };
    } catch (error: any) {
      logger?.error("❌ [CheckUserPermission] 检查失败", error);
      return {
        hasPermission: false,
        reason: `检查失败: ${error.message}`,
      };
    }
  },
});
