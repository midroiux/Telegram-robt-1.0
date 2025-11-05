import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { exampleAgent } from "../agents/exampleAgent";

/**
 * Example Mastra Workflow
 *
 * MASTRA WORKFLOW GUIDE:
 * - Workflows orchestrate multiple steps in sequence
 * - Each step has typed inputs/outputs for reliability
 * - Steps can use agents, tools, or custom logic
 */

/**
 * Step 1: Process with Agent
 * This step demonstrates how to use an agent within a workflow
 */
const processWithAgent = createStep({
  id: "process-with-agent",
  description: "Uses the example agent to process input",

  // Define what this step expects as input
  inputSchema: z.object({
    message: z.string().describe("Message to process"),
    includeAnalysis: z
      .boolean()
      .optional()
      .describe("Whether to include detailed analysis"),
  }),

  // Define what this step will output
  outputSchema: z.object({
    agentResponse: z.string(),
    processedData: z
      .object({
        original: z.string(),
        processed: z.string(),
        timestamp: z.string(),
      })
      .optional(),
  }),

  // Step logic - note the destructured parameters
  execute: async ({ inputData }) => {
    console.log("🚀 Step 1: Processing with agent...");

    // Construct a prompt for the agent
    const prompt = `
      Please process the following message using the example tool:
      "${inputData.message}"

      ${inputData.includeAnalysis ? "Also provide a brief analysis of the results." : ""}
    `;

    // Use the agent - you can use generate() or stream()
    const response = await exampleAgent.generate([
      { role: "user", content: prompt },
    ]);

    // In a real workflow, you might:
    // - Parse structured data from the response
    // - Extract specific information
    // - Handle errors gracefully

    return {
      agentResponse: response.text,
      processedData: {
        original: inputData.message,
        processed: inputData.message.toUpperCase(), // Simple mock processing
        timestamp: new Date().toISOString(),
      },
    };
  },
});

/**
 * Step 2: Output Results
 * This step demonstrates how to handle and output results
 */
const outputResults = createStep({
  id: "output-results",
  description: "Formats and outputs the final results",

  // This step receives the output from the previous step
  inputSchema: z.object({
    agentResponse: z.string(),
    processedData: z
      .object({
        original: z.string(),
        processed: z.string(),
        timestamp: z.string(),
      })
      .optional(),
  }),

  // Final output schema - this is what the workflow returns
  outputSchema: z.object({
    summary: z.string(),
    formattedOutput: z.string(),
    success: z.boolean(),
  }),

  execute: async ({ inputData }) => {
    console.log("📤 Step 2: Outputting results...");

    /**
     * In a real workflow, this step might:
     * - Send data to an API
     * - Write to a database
     * - Send an email
     * - Update a UI
     * - Trigger webhooks
     * - Store in a file system
     */

    // For this example, we'll format and log the output
    const formattedOutput = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 WORKFLOW RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Agent Response:
${inputData.agentResponse}

📝 Processed Data:
${
  inputData.processedData
    ? `
  • Original: ${inputData.processedData.original}
  • Processed: ${inputData.processedData.processed}
  • Timestamp: ${inputData.processedData.timestamp}
`
    : "No processed data available"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 NOTE: In a real implementation, this is where you would:
- Send results to your database
- Trigger notifications
- Update external systems
- Generate reports
- etc.
`;

    // Log the output (in production, you'd send this somewhere)
    console.log(formattedOutput);

    return {
      summary: `Successfully processed message with ${inputData.processedData?.original.length || 0} characters`,
      formattedOutput,
      success: true,
    };
  },
});

/**
 * Create the workflow by chaining steps
 */
export const exampleWorkflow = createWorkflow({
  id: "example-workflow",

  // Define the initial input schema for the entire workflow
  inputSchema: z.object({
    message: z.string().describe("Message to process through the workflow"),
    includeAnalysis: z
      .boolean()
      .optional()
      .describe("Whether to include detailed analysis"),
  }),

  // Define the final output schema (should match the last step's output)
  outputSchema: z.object({
    summary: z.string(),
    formattedOutput: z.string(),
    success: z.boolean(),
  }),
})
  // Chain your steps in order
  .then(processWithAgent)
  .then(outputResults)
  .commit();
