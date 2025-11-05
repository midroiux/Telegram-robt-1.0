import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Example Mastra Tool
 *
 * MASTRA TOOL GUIDE:
 * - Tools are reusable functions that can be used by agents and workflows
 * - Use createTool() to define a tool with typed inputs/outputs
 * - Tools should be focused on a single task
 * - Always include clear descriptions for the tool and its parameters
 */

// Define the input and output schemas using Zod
// This provides type safety and validation
export const exampleTool = createTool({
  id: "example-tool",

  // Describe what your tool does - this helps agents understand when to use it
  description:
    "A simple example tool that demonstrates how to create Mastra tools",

  // Define what inputs your tool expects
  // Use .describe() to add helpful descriptions for each field
  inputSchema: z.object({
    message: z.string().describe("A message to process"),
    count: z.number().optional().describe("Optional number parameter"),
  }),

  // Define what your tool will return
  outputSchema: z.object({
    processed: z.string(),
    timestamp: z.string(),
    metadata: z.object({
      characterCount: z.number(),
      wordCount: z.number(),
    }),
  }),

  // The execute function contains your tool's logic
  // It receives a context object with the validated input data
  execute: async ({ context }) => {
    // In a real tool, you might:
    // 1. Call external APIs
    // 2. Process data
    // 3. Interact with databases
    // 4. Transform information

    // For this example, we'll do some trivial data processing as an example
    console.log("🔧 Example tool executing with:", context);
    const processedMessage = context.message.toUpperCase();
    const words = context.message.split(" ").filter((w) => w.length > 0);

    // Return data matching the output schema
    return {
      processed: processedMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        characterCount: context.message.length,
        wordCount: words.length,
      },
    };
  },
});
