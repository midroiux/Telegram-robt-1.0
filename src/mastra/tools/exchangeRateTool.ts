import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Exchange Rate Tool for Currency Conversion
 * 
 * This tool provides real-time currency exchange rates and conversion functionality
 * using the exchangerate-api.com free API (no key required for basic usage)
 */

/**
 * Tool: Get Exchange Rate
 * Fetches the current exchange rate between two currencies
 */
export const getExchangeRate = createTool({
  id: "get-exchange-rate",
  description: "获取两种货币之间的实时汇率",
  
  inputSchema: z.object({
    from: z.string().describe("源货币代码,如 USD, CNY, EUR 等"),
    to: z.string().describe("目标货币代码,如 USD, CNY, EUR 等"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    from: z.string(),
    to: z.string(),
    rate: z.number(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [GetExchangeRate] 开始执行", context);
    
    try {
      const fromCurrency = context.from.toUpperCase();
      const toCurrency = context.to.toUpperCase();
      
      // 使用免费的汇率 API
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
      );
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.statusText}`);
      }
      
      const data = await response.json();
      const rate = data.rates[toCurrency];
      
      if (!rate) {
        throw new Error(`未找到 ${fromCurrency} 到 ${toCurrency} 的汇率`);
      }
      
      logger?.info("✅ [GetExchangeRate] 成功获取汇率", {
        from: fromCurrency,
        to: toCurrency,
        rate,
      });
      
      return {
        success: true,
        from: fromCurrency,
        to: toCurrency,
        rate,
        message: `当前汇率: 1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`,
      };
    } catch (error: any) {
      logger?.error("❌ [GetExchangeRate] 获取汇率失败", { error: error.message });
      return {
        success: false,
        from: context.from,
        to: context.to,
        rate: 0,
        message: `获取汇率失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Convert Currency
 * Converts an amount from one currency to another using real-time rates
 */
export const convertCurrency = createTool({
  id: "convert-currency",
  description: "将金额从一种货币转换为另一种货币",
  
  inputSchema: z.object({
    amount: z.number().describe("要转换的金额"),
    from: z.string().describe("源货币代码,如 USD, CNY, EUR 等"),
    to: z.string().describe("目标货币代码,如 USD, CNY, EUR 等"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    originalAmount: z.number(),
    convertedAmount: z.number(),
    from: z.string(),
    to: z.string(),
    rate: z.number(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [ConvertCurrency] 开始执行", context);
    
    try {
      const fromCurrency = context.from.toUpperCase();
      const toCurrency = context.to.toUpperCase();
      
      // 获取汇率
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
      );
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.statusText}`);
      }
      
      const data = await response.json();
      const rate = data.rates[toCurrency];
      
      if (!rate) {
        throw new Error(`未找到 ${fromCurrency} 到 ${toCurrency} 的汇率`);
      }
      
      const convertedAmount = context.amount * rate;
      
      logger?.info("✅ [ConvertCurrency] 成功转换货币", {
        originalAmount: context.amount,
        convertedAmount,
        from: fromCurrency,
        to: toCurrency,
        rate,
      });
      
      return {
        success: true,
        originalAmount: context.amount,
        convertedAmount,
        from: fromCurrency,
        to: toCurrency,
        rate,
        message: `${context.amount} ${fromCurrency} = ${convertedAmount.toFixed(2)} ${toCurrency}\n(汇率: 1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency})`,
      };
    } catch (error: any) {
      logger?.error("❌ [ConvertCurrency] 转换货币失败", { error: error.message });
      return {
        success: false,
        originalAmount: context.amount,
        convertedAmount: 0,
        from: context.from,
        to: context.to,
        rate: 0,
        message: `转换货币失败: ${error.message}`,
      };
    }
  },
});

/**
 * Tool: Get Multiple Exchange Rates
 * Fetches exchange rates for multiple currencies at once
 */
export const getMultipleExchangeRates = createTool({
  id: "get-multiple-exchange-rates",
  description: "获取一种货币相对于多种其他货币的汇率",
  
  inputSchema: z.object({
    base: z.string().describe("基准货币代码,如 USD, CNY 等"),
    targets: z.array(z.string()).describe("目标货币代码数组,如 ['USD', 'EUR', 'JPY']"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    base: z.string(),
    rates: z.record(z.number()),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [GetMultipleExchangeRates] 开始执行", context);
    
    try {
      const baseCurrency = context.base.toUpperCase();
      
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
      );
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.statusText}`);
      }
      
      const data = await response.json();
      const rates: Record<string, number> = {};
      
      for (const target of context.targets) {
        const targetCurrency = target.toUpperCase();
        if (data.rates[targetCurrency]) {
          rates[targetCurrency] = data.rates[targetCurrency];
        }
      }
      
      const ratesList = Object.entries(rates)
        .map(([currency, rate]) => `1 ${baseCurrency} = ${rate.toFixed(4)} ${currency}`)
        .join('\n');
      
      logger?.info("✅ [GetMultipleExchangeRates] 成功获取多个汇率", { rates });
      
      return {
        success: true,
        base: baseCurrency,
        rates,
        message: `${baseCurrency} 汇率:\n${ratesList}`,
      };
    } catch (error: any) {
      logger?.error("❌ [GetMultipleExchangeRates] 获取多个汇率失败", {
        error: error.message,
      });
      return {
        success: false,
        base: context.base,
        rates: {},
        message: `获取汇率失败: ${error.message}`,
      };
    }
  },
});
