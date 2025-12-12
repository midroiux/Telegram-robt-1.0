import { dailySettlementCron } from "./src/mastra/workflows/dailySettlementWorkflow";

async function testDailySettlement() {
  console.log("🧪 开始测试每日结算定时任务...");
  
  try {
    // 手动调用cron function
    // 注意：这只是测试逻辑，实际cron会自动触发
    const mockEvent: any = {
      name: "cron/daily-settlement",
      data: {},
      ts: Date.now(),
    };
    
    const mockStep = {
      run: async (id: string, fn: () => Promise<any>) => {
        console.log(`📝 执行步骤: ${id}`);
        const result = await fn();
        console.log(`✅ 步骤完成: ${id}`, result);
        return result;
      },
    };
    
    const mockLogger = {
      info: (...args: any[]) => console.log("[INFO]", ...args),
      error: (...args: any[]) => console.error("[ERROR]", ...args),
      warn: (...args: any[]) => console.warn("[WARN]", ...args),
      debug: (...args: any[]) => console.log("[DEBUG]", ...args),
    };
    
    // @ts-ignore
    const result = await dailySettlementCron.handler({
      event: mockEvent,
      step: mockStep,
      logger: mockLogger,
      runId: "test-run-" + Date.now(),
      fnId: "daily-settlement-cron",
      ctx: {},
      reqArgs: null,
    });
    
    console.log("\n✅ 测试完成！");
    console.log("结果:", JSON.stringify(result, null, 2));
    
  } catch (error: any) {
    console.error("\n❌ 测试失败:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDailySettlement();
