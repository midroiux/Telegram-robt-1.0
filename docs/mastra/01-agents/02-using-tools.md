---
title: "Using Tools with Agents | Agents | Mastra Docs"
description: Learn how to create tools, add them to Mastra agents, and integrate tools from MCP servers.
---

# Using Tools with Agents
[EN] Source: https://mastra.ai/en/docs/agents/using-tools-and-mcp

Tools are typed functions that can be executed by agents or workflows. Each tool has a schema defining its inputs, an executor function implementing its logic, and optional access to configured integrations.

## Creating Tools

Here's a basic example of creating a tool:

```typescript filename="src/mastra/tools/weatherInfo.ts" copy
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherInfo = createTool({
  id: "Get Weather Information",
  inputSchema: z.object({
    city: z.string(),
  }),
  description: `Fetches the current weather information for a given city`,
  execute: async ({ context: { city } }) => {
    // Tool logic here (e.g., API call)
    console.log("Using tool to fetch weather information for", city);
    return { temperature: 20, conditions: "Sunny" }; // Example return
  },
});
```

For details on creating and designing tools, see the [Tools Overview](/docs/tools-mcp/overview).

## Adding Tools to an Agent

To make a tool available to an agent, add it to the `tools` property in the agent's configuration.

```typescript filename="src/mastra/agents/weatherAgent.ts" {3,11}
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { weatherInfo } from "../tools/weatherInfo";

export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions:
    "You are a helpful assistant that provides current weather information. When asked about the weather, use the weather information tool to fetch the data.",
  model: openai("gpt-4o-mini"),
  tools: {
    weatherInfo,
  },
});
```

When you call the agent, it can now decide to use the configured tool based on its instructions and the user's prompt.

## Adding MCP Tools to an Agent

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) provides a standardized way for AI models to discover and interact with external tools and resources. You can connect your Mastra agent to MCP servers to use tools provided by third parties.

For more details on MCP concepts and how to set up MCP clients and servers, see the [MCP Overview](/docs/tools-mcp/mcp-overview).

### Installation

First, install the Mastra MCP package:

```bash npm2yarn copy
npm install @mastra/mcp@latest
```

### Using MCP Tools

Because there are so many MCP server registries to choose from, we've created an [MCP Registry Registry](https://mastra.ai/mcp-registry-registry) to help you find MCP servers.

Once you have a server you want to use with your agent, import the Mastra `MCPClient` and add the server configuration.

```typescript filename="src/mastra/mcp.ts" {1,7-16}
import { MCPClient } from "@mastra/mcp";

// Configure MCPClient to connect to your server(s)
export const mcp = new MCPClient({
  servers: {
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Downloads",
      ],
    },
  },
});
```

Then connect your agent to the server tools:

```typescript filename="src/mastra/agents/mcpAgent.ts" {7}
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { mcp } from "../mcp";

// Create an agent and add tools from the MCP client
const agent = new Agent({
  name: "Agent with MCP Tools",
  instructions: "You can use tools from connected MCP servers.",
  model: openai("gpt-4o-mini"),
  tools: await mcp.getTools(),
});
```

For more details on configuring `MCPClient` and the difference between static and dynamic MCP server configurations, see the [MCP Overview](/docs/tools-mcp/mcp-overview).

## Accessing MCP Resources

In addition to tools, MCP servers can also expose resources - data or content that can be retrieved and used in your application.

```typescript filename="src/mastra/resources.ts" {3-8}
import { mcp } from "./mcp";

// Get resources from all connected MCP servers
const resources = await mcp.getResources();

// Access resources from a specific server
if (resources.filesystem) {
  const resource = resources.filesystem.find(
    (r) => r.uri === "filesystem://Downloads",
  );
  console.log(`Resource: ${resource?.name}`);
}
```

Each resource has a URI, name, description, and MIME type. The `getResources()` method handles errors gracefully - if a server fails or doesn't support resources, it will be omitted from the results.

## Accessing MCP Prompts

MCP servers can also expose prompts, which represent structured message templates or conversational context for agents.

### Listing Prompts

```typescript filename="src/mastra/prompts.ts"
import { mcp } from "./mcp";

// Get prompts from all connected MCP servers
const prompts = await mcp.prompts.list();

// Access prompts from a specific server
if (prompts.weather) {
  const prompt = prompts.weather.find(
    (p) => p.name === "current"
  );
  console.log(`Prompt: ${prompt?.name}`);
}
```

Each prompt has a name, description, and (optional) version.

### Retrieving a Prompt and Its Messages

```typescript filename="src/mastra/prompts.ts"
const { prompt, messages } = await mcp.prompts.get({ serverName: "weather", name: "current" });
console.log(prompt);    // { name: "current", version: "v1", ... }
console.log(messages);  // [ { role: "assistant", content: { type: "text", text: "..." } }, ... ]
```

## Exposing Agents as Tools via MCPServer

In addition to using tools from MCP servers, your Mastra Agents themselves can be exposed as tools to any MCP-compatible client using Mastra's `MCPServer`.

When an `Agent` instance is provided to an `MCPServer` configuration:

- It is automatically converted into a callable tool.
- The tool is named `ask_<agentKey>`, where `<agentKey>` is the identifier you used when adding the agent to the `MCPServer`'s `agents` configuration.
- The agent's `description` property (which must be a non-empty string) is used to generate the tool's description.

This allows other AI models or MCP clients to interact with your Mastra Agents as if they were standard tools, typically by "asking" them a question.

**Example `MCPServer` Configuration with an Agent:**

```typescript filename="src/mastra/mcp.ts"
import { Agent } from "@mastra/core/agent";
import { MCPServer } from "@mastra/mcp";
import { openai } from "@ai-sdk/openai";
import { weatherInfo } from "../tools/weatherInfo";
import { generalHelper } from "../agents/generalHelper";

const server = new MCPServer({
  name: "My Custom Server with Agent-Tool",
  version: "1.0.0",
  tools: {
    weatherInfo,
  },
  agents: { generalHelper }, // Exposes 'ask_generalHelper' tool
});
```

For an agent to be successfully converted into a tool by `MCPServer`, its `description` property must be set to a non-empty string in its constructor configuration. If the description is missing or empty, `MCPServer` will throw an error during initialization.

For more details on setting up and configuring `MCPServer`, refer to the [MCPServer reference documentation](/reference/tools/mcp-server).


---
title: "Reference: createTool() | Tools | Agents | Mastra Docs"
description: Documentation for the createTool function in Mastra, which creates custom tools for agents and workflows.
---

# `createTool()`
[EN] Source: https://mastra.ai/en/reference/agents/createTool

The `createTool()` function creates typed tools that can be executed by agents or workflows. Tools have built-in schema validation, execution context, and integration with the Mastra ecosystem.

## Overview

Tools are a fundamental building block in Mastra that allow agents to interact with external systems, perform computations, and access data. Each tool has:

- A unique identifier
- A description that helps the AI understand when and how to use the tool
- Optional input and output schemas for validation
- An execution function that implements the tool's logic

## Example Usage

```ts filename="src/tools/stock-tools.ts" showLineNumbers copy
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Helper function to fetch stock data
const getStockPrice = async (symbol: string) => {
  const response = await fetch(
    `https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`,
  );
  const data = await response.json();
  return data.prices["4. close"];
};

// Create a tool to get stock prices
export const stockPriceTool = createTool({
  id: "getStockPrice",
  description: "Fetches the current stock price for a given ticker symbol",
  inputSchema: z.object({
    symbol: z.string().describe("The stock ticker symbol (e.g., AAPL, MSFT)"),
  }),
  outputSchema: z.object({
    symbol: z.string(),
    price: z.number(),
    currency: z.string(),
    timestamp: z.string(),
  }),
  execute: async ({ context }) => {
    const price = await getStockPrice(context.symbol);

    return {
      symbol: context.symbol,
      price: parseFloat(price),
      currency: "USD",
      timestamp: new Date().toISOString(),
    };
  },
});

// Create a tool that uses the thread context
export const threadInfoTool = createTool({
  id: "getThreadInfo",
  description: "Returns information about the current conversation thread",
  inputSchema: z.object({
    includeResource: z.boolean().optional().default(false),
  }),
  execute: async ({ context, threadId, resourceId }) => {
    return {
      threadId,
      resourceId: context.includeResource ? resourceId : undefined,
      timestamp: new Date().toISOString(),
    };
  },
});
```

## API Reference

### Parameters

`createTool()` accepts a single object with the following properties:

<PropertiesTable
  content={[
    {
      name: "id",
      type: "string",
      required: true,
      description:
        "Unique identifier for the tool. This should be descriptive of the tool's function.",
    },
    {
      name: "description",
      type: "string",
      required: true,
      description:
        "Detailed description of what the tool does, when it should be used, and what inputs it requires. This helps the AI understand how to use the tool effectively.",
    },
    {
      name: "execute",
      type: "(context: ToolExecutionContext, options?: any) => Promise<any>",
      required: false,
      description:
        "Async function that implements the tool's logic. Receives the execution context and optional configuration.",
      properties: [
        {
          type: "ToolExecutionContext",
          parameters: [
            {
              name: "context",
              type: "object",
              description:
                "The validated input data that matches the inputSchema",
            },
            {
              name: "threadId",
              type: "string",
              isOptional: true,
              description:
                "Identifier for the conversation thread, if available",
            },
            {
              name: "resourceId",
              type: "string",
              isOptional: true,
              description:
                "Identifier for the user or resource interacting with the tool",
            },
            {
              name: "mastra",
              type: "Mastra",
              isOptional: true,
              description: "Reference to the Mastra instance, if available",
            },
          ],
        },
        {
          type: "ToolOptions",
          parameters: [
            {
              name: "toolCallId",
              type: "string",
              description:
                "The ID of the tool call. You can use it e.g. when sending tool-call related information with stream data.",
            },
            {
              name: "messages",
              type: "CoreMessage[]",
              description:
                "Messages that were sent to the language model to initiate the response that contained the tool call. The messages do not include the system prompt nor the assistant response that contained the tool call.",
            },
            {
              name: "abortSignal",
              type: "AbortSignal",
              isOptional: true,
              description:
                "An optional abort signal that indicates that the overall operation should be aborted.",
            },
          ],
        },
      ],
    },
    {
      name: "inputSchema",
      type: "ZodSchema",
      required: false,
      description:
        "Zod schema that defines and validates the tool's input parameters. If not provided, the tool will accept any input.",
    },
    {
      name: "outputSchema",
      type: "ZodSchema",
      required: false,
      description:
        "Zod schema that defines and validates the tool's output. Helps ensure the tool returns data in the expected format.",
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: "Tool",
      type: "Tool<TSchemaIn, TSchemaOut>",
      description:
        "A Tool instance that can be used with agents, workflows, or directly executed.",
      properties: [
        {
          type: "Tool",
          parameters: [
            {
              name: "id",
              type: "string",
              description: "The tool's unique identifier",
            },
            {
              name: "description",
              type: "string",
              description: "Description of the tool's functionality",
            },
            {
              name: "inputSchema",
              type: "ZodSchema | undefined",
              description: "Schema for validating inputs",
            },
            {
              name: "outputSchema",
              type: "ZodSchema | undefined",
              description: "Schema for validating outputs",
            },
            {
              name: "execute",
              type: "Function",
              description: "The tool's execution function",
            },
          ],
        },
      ],
    },
  ]}
/>

## Type Safety

The `createTool()` function provides full type safety through TypeScript generics:

- Input types are inferred from the `inputSchema`
- Output types are inferred from the `outputSchema`
- The execution context is properly typed based on the input schema

This ensures that your tools are type-safe throughout your application.

## Best Practices

1. **Descriptive IDs**: Use clear, action-oriented IDs like `getWeatherForecast` or `searchDatabase`
2. **Detailed Descriptions**: Provide comprehensive descriptions that explain when and how to use the tool
3. **Input Validation**: Use Zod schemas to validate inputs and provide helpful error messages
4. **Error Handling**: Implement proper error handling in your execute function
5. **Idempotency**: When possible, make your tools idempotent (same input always produces same output)
6. **Performance**: Keep tools lightweight and fast to execute


---
title: "Example: Giving an Agent a Tool | Agents | Mastra Docs"
description: Example of creating an AI agent in Mastra that uses a dedicated tool to provide weather information.
---

import { GithubLink } from "@/components/github-link";

# Example: Giving an Agent a Tool
[EN] Source: https://mastra.ai/en/examples/agents/using-a-tool

When building AI agents, you often need to integrate external data sources or functionality to enhance their capabilities. This example shows how to create an AI agent that uses a dedicated weather tool to provide accurate weather information for specific locations.

```ts showLineNumbers copy
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});

const getWeather = async (location: string) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = await geocodingResponse.json();

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data: WeatherResponse = await response.json();

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return conditions[code] || "Unknown";
}

const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: `You are a helpful weather assistant that provides accurate weather information.
Your primary function is to help users get weather details for specific locations. When responding:
- Always ask for a location if none is provided
- If the location name isn’t in English, please translate it
- Include relevant details like humidity, wind conditions, and precipitation
- Keep responses concise but informative
Use the weatherTool to fetch current weather data.`,
  model: openai("gpt-4o-mini"),
  tools: { weatherTool },
});

const mastra = new Mastra({
  agents: { weatherAgent },
});

async function main() {
  const agent = await mastra.getAgent("weatherAgent");
  const result = await agent.generate("What is the weather in London?");
  console.log(result.text);
}

main();
```

<br />
<br />
<hr className="dark:border-[#404040] border-gray-300" />
<br />
<br />

<GithubLink
  link={
    "https://github.com/mastra-ai/mastra/blob/main/examples/basics/agents/using-a-tool"
  }
/>


