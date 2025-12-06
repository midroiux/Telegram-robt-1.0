import { Mastra } from "@mastra/core";
import { MastraError } from "@mastra/core/error";
import { PinoLogger } from "@mastra/loggers";
import { LogLevel, MastraLogger } from "@mastra/core/logger";
import pino from "pino";
import { MCPServer } from "@mastra/mcp";
import { NonRetriableError } from "inngest";
import { z } from "zod";

import { sharedPostgresStorage } from "./storage";
import { inngest, inngestServe } from "./inngest";
import { accountingWorkflow } from "./workflows/accountingWorkflow";
import { accountingAgent } from "./agents/accountingAgent";

// 操作人管理工具
import {
  addOperator,
  removeOperator,
  checkUserPermission,
  listOperators,
} from "./tools/groupAccountingTools";

// 交易记录工具
import {
  addIncomeRecord,
  addOutgoingRecord,
  revokeLastIncome,
  revokeLastOutgoing,
} from "./tools/transactionTools";

// 汇率费率工具
import {
  setExchangeRate,
  setIncomeFeeRate,
  setOutgoingFeeRate,
  convertTHBtoUSD,
  getGroupSettings,
  showCurrentRates,
  setCutoffTime,
  setLanguage,
} from "./tools/rateTools";

// 账单查询工具
import {
  showAllBills,
  showUserBills,
  showDetailedRecords,
} from "./tools/queryTools";

import { accountingBotTrigger } from "../triggers/telegramTriggers";

class ProductionPinoLogger extends MastraLogger {
  protected logger: pino.Logger;

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
    } = {},
  ) {
    super(options);

    this.logger = pino({
      name: options.name || "app",
      level: options.level || LogLevel.INFO,
      base: {},
      formatters: {
        level: (label: string, _number: number) => ({
          level: label,
        }),
      },
      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    });
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
  }
}

export const mastra = new Mastra({
  storage: sharedPostgresStorage,
  // Register your workflows here
  workflows: {
    accountingWorkflow,
  },
  // Register your agents here
  agents: {
    accountingAgent,
  },
  mcpServers: {
    allTools: new MCPServer({
      name: "allTools",
      version: "1.0.0",
      tools: {
        // 操作人管理
        addOperator,
        removeOperator,
        checkUserPermission,
        listOperators,
        // 交易记录
        addIncomeRecord,
        addOutgoingRecord,
        revokeLastIncome,
        revokeLastOutgoing,
        // 汇率费率和日切
        setExchangeRate,
        setIncomeFeeRate,
        setOutgoingFeeRate,
        convertTHBtoUSD,
        getGroupSettings,
        showCurrentRates,
        setCutoffTime,
        setLanguage,
        // 账单查询
        showAllBills,
        showUserBills,
        showDetailedRecords,
      },
    }),
  },
  bundler: {
    // A few dependencies are not properly picked up by
    // the bundler if they are not added directly to the
    // entrypoint.
    externals: [
      "@slack/web-api",
      "inngest",
      "inngest/hono",
      "hono",
      "hono/streaming",
    ],
    // sourcemaps are good for debugging.
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    middleware: [
      async (c, next) => {
        const mastra = c.get("mastra");
        const logger = mastra?.getLogger();
        logger?.debug("[Request]", { method: c.req.method, url: c.req.url });
        try {
          await next();
        } catch (error) {
          logger?.error("[Response]", {
            method: c.req.method,
            url: c.req.url,
            error,
          });
          if (error instanceof MastraError) {
            if (error.id === "AGENT_MEMORY_MISSING_RESOURCE_ID") {
              // This is typically a non-retirable error. It means that the request was not
              // setup correctly to pass in the necessary parameters.
              throw new NonRetriableError(error.message, { cause: error });
            }
          } else if (error instanceof z.ZodError) {
            // Validation errors are never retriable.
            throw new NonRetriableError(error.message, { cause: error });
          }

          throw error;
        }
      },
    ],
    apiRoutes: [
      // This API route is used to register the Mastra workflow (inngest function) on the inngest server
      {
        path: "/api/inngest",
        method: "ALL",
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
        // The inngestServe function integrates Mastra workflows with Inngest by:
        // 1. Creating Inngest functions for each workflow with unique IDs (workflow.${workflowId})
        // 2. Setting up event handlers that:
        //    - Generate unique run IDs for each workflow execution
        //    - Create an InngestExecutionEngine to manage step execution
        //    - Handle workflow state persistence and real-time updates
        // 3. Establishing a publish-subscribe system for real-time monitoring
        //    through the workflow:${workflowId}:${runId} channel
      },
      // Telegram webhook API routes
      ...accountingBotTrigger,
    ],
  },
  logger:
    process.env.NODE_ENV === "production"
      ? new ProductionPinoLogger({
          name: "Mastra",
          level: "info",
        })
      : new PinoLogger({
          name: "Mastra",
          level: "info",
        }),
});

/*  Sanity check 1: Throw an error if there are more than 1 workflows.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getWorkflows()).length > 1) {
  throw new Error(
    "More than 1 workflows found. Currently, more than 1 workflows are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}

/*  Sanity check 2: Throw an error if there are more than 1 agents.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getAgents()).length > 1) {
  throw new Error(
    "More than 1 agents found. Currently, more than 1 agents are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}

/**
 * 自动设置 Telegram Webhook
 * 在生产环境中，应用启动后自动设置正确的 Webhook URL
 * 这样可以防止 Inngest 覆盖我们的 Webhook 设置
 */
async function setupTelegramWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const replitDomains = process.env.REPLIT_DOMAINS;
  
  if (!botToken) {
    console.warn("[Webhook] TELEGRAM_BOT_TOKEN 未设置，跳过 Webhook 配置");
    return;
  }
  
  if (process.env.NODE_ENV !== "production" || !replitDomains) {
    console.log("[Webhook] 非生产环境或无域名，跳过自动 Webhook 配置");
    return;
  }
  
  const domain = replitDomains.split(",")[0];
  const webhookUrl = `https://${domain}/api/telegram/webhook`;
  
  try {
    // 延迟 5 秒等待 Inngest 完成初始化
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
      { method: "GET" }
    );
    
    const result = await response.json();
    
    if (result.ok) {
      console.log(`✅ [Webhook] Telegram Webhook 已自动设置: ${webhookUrl}`);
    } else {
      console.error(`❌ [Webhook] 设置失败:`, result.description);
    }
  } catch (error) {
    console.error(`❌ [Webhook] 设置出错:`, error);
  }
}

// 启动时自动设置 Webhook
setupTelegramWebhook();
