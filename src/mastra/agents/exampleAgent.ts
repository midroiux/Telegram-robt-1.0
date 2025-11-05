import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { exampleTool } from "../tools/exampleTool";

/**
 * Example Mastra Agent
 *
 * MASTRA AGENT GUIDE:
 * - Agents are AI-powered assistants that can use tools and maintain conversation memory
 * - They combine an LLM model with tools and optional memory storage
 * - Agents can be used in workflows
 */

export const exampleAgent = new Agent({
  // Give your agent a descriptive name
  name: "Example Agent",

  /**
   * Instructions define your agent's behavior and personality
   * Be specific about:
   * - What the agent should do
   * - How it should respond
   * - What tools it should use and when
   * - Any constraints or guidelines
   */
  instructions: `
    You are a helpful example agent that demonstrates how to use Mastra agents.

    Your primary function is to process messages using the example tool and explain what you're doing.

    When responding:
    - Always be helpful and educational
    - Explain what tools you're using and why
    - If asked to process a message, use the exampleTool
    - Share the results in a clear, formatted way
    - Add educational comments about how Mastra works when relevant

    Remember: You're teaching developers how to use Mastra by example!
`,

  /**
   * Choose your LLM model
   */
  model: openai("gpt-4o-mini"),

  /**
   * Provide tools that the agent can use
   * Tools must be created with createTool()
   * You can provide multiple tools: { tool1, tool2, tool3 }
   */
  tools: { exampleTool },

  /**
   * Optional: Add memory to persist conversations
   * Memory allows agents to remember past interactions
   */
  memory: new Memory({
    storage: new LibSQLStore({
      // Use ':memory:' for in-memory storage (doesn't persist)
      // Use 'file:./path/to/db.db' for persistent storage
      url: ":memory:",
    }),
  }),

  /**
   * Optional: Configure additional settings
   */
  // maxSteps: 10, // Limit tool usage iterations
  // temperature: 0.7, // Control creativity (0-1)
});
