---
title: "Introduction | Mastra Docs"
description: "Mastra is a TypeScript agent framework. It helps you build AI applications and features quickly. It gives you the set of primitives you need: workflows, agents, RAG, integrations, syncs and evals."
---

# About Mastra
[EN] Source: https://mastra.ai/en/docs

Mastra is an open-source TypeScript agent framework.

It's designed to give you the primitives you need to build AI applications and features.

You can use Mastra to build [AI agents](/docs/agents/overview.mdx) that have memory and can execute functions, or chain LLM calls in deterministic [workflows](/docs/workflows/overview.mdx). You can chat with your agents in Mastra's [local dev environment](/docs/local-dev/mastra-dev.mdx), feed them application-specific knowledge with [RAG](/docs/rag/overview.mdx), and score their outputs with Mastra's [evals](/docs/evals/overview.mdx).

The main features include:

- **[Model routing](https://sdk.vercel.ai/docs/introduction)**: Mastra uses the [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction) for model routing, providing a unified interface to interact with any LLM provider including OpenAI, Anthropic, and Google Gemini.
- **[Agent memory and tool calling](/docs/agents/agent-memory.mdx)**: With Mastra, you can give your agent tools (functions) that it can call. You can persist agent memory and retrieve it based on recency, semantic similarity, or conversation thread.
- **[Workflow graphs](/docs/workflows/overview.mdx)**: When you want to execute LLM calls in a deterministic way, Mastra gives you a graph-based workflow engine. You can define discrete steps, log inputs and outputs at each step of each run, and pipe them into an observability tool. Mastra workflows have a simple syntax for control flow (`.then()`, `.branch()`, `.parallel()`) that allows branching and chaining.
- **[Agent development environment](/docs/local-dev/mastra-dev.mdx)**: When you're developing an agent locally, you can chat with it and see its state and memory in Mastra's agent development environment.
- **[Retrieval-augmented generation (RAG)](/docs/rag/overview.mdx)**: Mastra gives you APIs to process documents (text, HTML, Markdown, JSON) into chunks, create embeddings, and store them in a vector database. At query time, it retrieves relevant chunks to ground LLM responses in your data, with a unified API on top of multiple vector stores (Pinecone, pgvector, etc) and embedding providers (OpenAI, Cohere, etc).
- **[Deployment](/docs/deployment/deployment.mdx)**: Mastra supports bundling your agents and workflows within an existing React, Next.js, or Node.js application, or into standalone endpoints. The Mastra deploy helper lets you easily bundle agents and workflows into a Node.js server using Hono, or deploy it onto a serverless platform like Vercel, Cloudflare Workers, or Netlify.
- **[Evals](/docs/evals/overview.mdx)**: Mastra provides automated evaluation metrics that use model-graded, rule-based, and statistical methods to assess LLM outputs, with built-in metrics for toxicity, bias, relevance, and factual accuracy. You can also define your own evals.


---
title: Understanding the Mastra Cloud Dashboard
description: Details of each feature available in Mastra Cloud
---

import { MastraCloudCallout } from '@/components/mastra-cloud-callout'

# Understanding Tracing and Logs
[EN] Source: https://mastra.ai/en/docs/mastra-cloud/observability

Mastra Cloud captures execution data to help you monitor your application's behavior in the production environment.

<MastraCloudCallout />

## Logs

You can view detailed logs for debugging and monitoring your application's behavior on the [Logs](/docs/mastra-cloud/dashboard#logs) page of the Dashboard.

![Dashboard logs](/image/mastra-cloud/mastra-cloud-dashboard-logs.jpg)

Key features:

Each log entry includes its severity level and a detailed message showing agent, workflow, or storage activity.

## Traces

More detailed traces are available for both agents and workflows by using a [logger](/docs/observability/logging) or enabling [telemetry](/docs/observability/tracing) using one of our [supported providers](/reference/observability/providers).

### Agents

With a [logger](/docs/observability/logging) enabled, you can view detailed outputs from your agents in the **Traces** section of the Agents Playground.

![observability agents](/image/mastra-cloud/mastra-cloud-observability-agents.jpg)

Key features:

Tools passed to the agent during generation are standardized using `convertTools`. This includes retrieving client-side tools, memory tools, and tools exposed from workflows.


### Workflows

With a [logger](/docs/observability/logging) enabled, you can view detailed outputs from your workflows in the **Traces** section of the Workflows Playground.

![observability workflows](/image/mastra-cloud/mastra-cloud-observability-workflows.jpg)

Key features:

Workflows are created using `createWorkflow`, which sets up steps, metadata, and tools. You can run them with `runWorkflow` by passing input and options.

## Next steps

- [Logging](/docs/observability/logging)
- [Tracing](/docs/observability/tracing)


---
title: Mastra Cloud
description: Deployment and monitoring service for Mastra applications
---

import { MastraCloudCallout } from '@/components/mastra-cloud-callout'
import { FileTree } from "nextra/components";

# Logging
[EN] Source: https://mastra.ai/en/docs/observability/logging

In Mastra, logs can detail when certain functions run, what input data they receive, and how they respond.

## Basic Setup

Here's a minimal example that sets up a **console logger** at the `INFO` level. This will print out informational messages and above (i.e., `DEBUG`, `INFO`, `WARN`, `ERROR`) to the console.

```typescript filename="mastra.config.ts" showLineNumbers copy
import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";

export const mastra = new Mastra({
  // Other Mastra configuration...
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
```

In this configuration:

- `name: "Mastra"` specifies the name to group logs under.
- `level: "info"` sets the minimum severity of logs to record.

## Configuration

- For more details on the options you can pass to `PinoLogger()`, see the [PinoLogger reference documentation](/reference/observability/logger).
- Once you have a `Logger` instance, you can call its methods (e.g., `.info()`, `.warn()`, `.error()`) in the [Logger instance reference documentation](/reference/observability/logger).
- If you want to send your logs to an external service for centralized collection, analysis, or storage, you can configure other logger types such as Upstash Redis. Consult the [Logger reference documentation](/reference/observability/logger) for details on parameters like `url`, `token`, and `key` when using the `UPSTASH` logger type.


---
title: "Mastra Core"
description: Documentation for the Mastra Class, the core entry point for managing agents, workflows, MCP servers, and server endpoints.
---

# The Mastra Class
[EN] Source: https://mastra.ai/en/reference/core/mastra-class

The `Mastra` class is the central orchestrator in any Mastra application, managing agents, workflows, storage, logging, telemetry, and more. Typically, you create a single instance of `Mastra` to coordinate your application.

Think of `Mastra` as a top-level registry:

- Registering **integrations** makes them accessible to **agents**, **workflows**, and **tools** alike.
- **tools** aren’t registered on `Mastra` directly but are associated with agents and discovered automatically.


## Importing

```typescript
import { Mastra } from "@mastra/core";
```

## Constructor

Creates a new `Mastra` instance with the specified configuration.

```typescript
constructor(config?: Config);
```

## Initialization

The Mastra class is typically initialized in your `src/mastra/index.ts` file:

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { weatherAgent } from "./agents/weather-agent";

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
});
```

## Configuration Object

The constructor accepts an optional `Config` object to customize its behavior and integrate various Mastra components. All properties on the `Config` object are optional.

### Properties

<PropertiesTable
  content={[
    {
      name: "agents",
      type: "Agent[]",
      description: "Array of Agent instances to register",
      isOptional: true,
      defaultValue: "[]",
    },
    {
      name: "tools",
      type: "Record<string, ToolApi>",
      description:
        "Custom tools to register. Structured as a key-value pair, with keys being the tool name and values being the tool function.",
      isOptional: true,
      defaultValue: "{}",
    },
    {
      name: "storage",
      type: "MastraStorage",
      description: "Storage engine instance for persisting data",
      isOptional: true,
    },
    {
      name: "vectors",
      type: "Record<string, MastraVector>",
      description:
        "Vector store instance, used for semantic search and vector-based tools (eg Pinecone, PgVector or Qdrant)",
      isOptional: true,
    },
    {
      name: "logger",
      type: "Logger",
      description: "Logger instance created with new PinoLogger()",
      isOptional: true,
      defaultValue: "Console logger with INFO level",
    },
    {
      name: "workflows",
      type: "Record<string, Workflow>",
      description:
        "Workflows to register. Structured as a key-value pair, with keys being the workflow name and values being the workflow instance.",
      isOptional: true,
      defaultValue: "{}",
    },
    {
      name: "tts",
      type: "Record<string, MastraTTS>",
      isOptional: true,
      description: "An object for registering Text-To-Speech services.",
    },
    {
      name: "telemetry",
      type: "OtelConfig",
      isOptional: true,
      description: "Configuration for OpenTelemetry integration.",
    },
    {
      name: "deployer",
      type: "MastraDeployer",
      isOptional: true,
      description: "An instance of a MastraDeployer for managing deployments.",
    },
    {
      name: "server",
      type: "ServerConfig",
      description:
        "Server configuration including port, host, timeout, API routes, middleware, CORS settings, and build options for Swagger UI, API request logging, and OpenAPI docs.",
      isOptional: true,
      defaultValue:
        "{ port: 5000, host: localhost,  cors: { origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type'], exposeHeaders: ['Content-Length', 'X-Requested-With'], credentials: false } }",
    },
    {
      name: "mcpServers",
      type: "Record<string, MCPServerBase>",
      isOptional: true,
      description:
        "An object where keys are unique server identifiers and values are instances of MCPServer or classes extending MCPServerBase. This allows Mastra to be aware of and potentially manage these MCP servers.",
    },
    {
      name: "bundler",
      type: "BundlerConfig",
      description: "Configuration for the asset bundler.",
    },
  ]}
/>

## Usage

Any of the below methods can be used with the Mastra class, for example:

```typescript {3} filename="example.ts" showLineNumbers
import { mastra } from "./mastra";

const agent = mastra.getAgent("weatherAgent");
const result = await agent.generate("What's the weather like in London?");
```

### Methods

<PropertiesTable
  content={[
    {
      name: "getAgent(name)",
      type: "Agent",
      description:
        "Returns an agent instance by id. Throws if agent not found.",
      example: 'const agent = mastra.getAgent("agentOne");',
    },
    {
      name: "getAgents()",
      type: "Record<string, Agent>",
      description: "Returns all registered agents as a key-value object.",
      example: "const agents = mastra.getAgents();",
    },
    {
      name: "getWorkflow(id, { serialized })",
      type: "Workflow",
      description:
        "Returns a workflow instance by id. The serialized option (default: false) returns a simplified representation with just the name.",
      example: 'const workflow = mastra.getWorkflow("myWorkflow");',
    },
    {
      name: "getWorkflows({ serialized })",
      type: "Record<string, Workflow>",
      description:
        "Returns all registered workflows. The serialized option (default: false) returns simplified representations.",
      example: "const workflows = mastra.getWorkflows();",
    },
    {
      name: "getVector(name)",
      type: "MastraVector",
      description:
        "Returns a vector store instance by name. Throws if not found.",
      example: 'const vectorStore = mastra.getVector("myVectorStore");',
    },
    {
      name: "getVectors()",
      type: "Record<string, MastraVector>",
      description:
        "Returns all registered vector stores as a key-value object.",
      example: "const vectorStores = mastra.getVectors();",
    },
    {
      name: "getDeployer()",
      type: "MastraDeployer | undefined",
      description: "Returns the configured deployer instance, if any.",
      example: "const deployer = mastra.getDeployer();",
    },
    {
      name: "getStorage()",
      type: "MastraStorage | undefined",
      description: "Returns the configured storage instance.",
      example: "const storage = mastra.getStorage();",
    },
    {
      name: "getMemory()",
      type: "MastraMemory | undefined",
      description:
        "Returns the configured memory instance. Note: This is deprecated, memory should be added to agents directly.",
      example: "const memory = mastra.getMemory();",
    },
    {
      name: "getServer()",
      type: "ServerConfig | undefined",
      description:
        "Returns the server configuration including port, timeout, API routes, middleware, CORS settings, and build options.",
      example: "const serverConfig = mastra.getServer();",
    },
    {
      name: "setStorage(storage)",
      type: "void",
      description: "Sets the storage instance for the Mastra instance.",
      example: "mastra.setStorage(new DefaultStorage());",
    },
    {
      name: "setLogger({ logger })",
      type: "void",
      description:
        "Sets the logger for all components (agents, workflows, etc.).",
      example:
        'mastra.setLogger({ logger: new PinoLogger({ name: "MyLogger" }) });',
    },
    {
      name: "setTelemetry(telemetry)",
      type: "void",
      description: "Sets the telemetry configuration for all components.",
      example: 'mastra.setTelemetry({ export: { type: "console" } });',
    },
    {
      name: "getLogger()",
      type: "Logger",
      description: "Gets the configured logger instance.",
      example: "const logger = mastra.getLogger();",
    },
    {
      name: "getTelemetry()",
      type: "Telemetry | undefined",
      description: "Gets the configured telemetry instance.",
      example: "const telemetry = mastra.getTelemetry();",
    },
    {
      name: "getLogsByRunId({ runId, transportId })",
      type: "Promise<any>",
      description: "Retrieves logs for a specific run ID and transport ID.",
      example:
        'const logs = await mastra.getLogsByRunId({ runId: "123", transportId: "456" });',
    },
    {
      name: "getLogs(transportId)",
      type: "Promise<any>",
      description: "Retrieves all logs for a specific transport ID.",
      example: 'const logs = await mastra.getLogs("transportId");',
    },
    {
      name: "getMCPServers()",
      type: "Record<string, MCPServerBase> | undefined",
      description: "Retrieves all registered MCP server instances.",
      example: "const mcpServers = mastra.getMCPServers();",
    },
  ]}
/>

## Error Handling

The Mastra class methods throw typed errors that can be caught:

```typescript {8} filename="example.ts" showLineNumbers
import { mastra } from "./mastra";

try {
  const agent = mastra.getAgent("weatherAgent");
  const result = await agent.generate("What's the weather like in London?");

} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  }
}
```


---
title: "Local Project Structure | Getting Started | Mastra Docs"
description: Guide on organizing folders and files in Mastra, including best practices and recommended structures.
---

import { FileTree } from "nextra/components";

# Project Structure
[EN] Source: https://mastra.ai/en/docs/getting-started/project-structure

This page provides a guide for organizing folders and files in Mastra. Mastra is a modular framework, and you can use any of the modules separately or together.

You could write everything in a single file, or separate each agent, tool, and workflow into their own files.

We don't enforce a specific folder structure, but we do recommend some best practices, and the CLI will scaffold a project with a sensible structure.

## Example Project Structure

A default project created with the CLI looks like this:

<FileTree>
  <FileTree.Folder name="src" defaultOpen>
    <FileTree.Folder name="mastra" defaultOpen>
      <FileTree.Folder name="agents" defaultOpen>
        <FileTree.File name="agent-name.ts" />
      </FileTree.Folder>
      <FileTree.Folder name="tools" defaultOpen>
        <FileTree.File name="tool-name.ts" />
      </FileTree.Folder>
      <FileTree.Folder name="workflows" defaultOpen>
        <FileTree.File name="workflow-name.ts" />
      </FileTree.Folder>
      <FileTree.File name="index.ts" />
    </FileTree.Folder>
  </FileTree.Folder>
  <FileTree.File name=".env" />
  <FileTree.File name="package.json" />
  <FileTree.File name="tsconfig.json" />
</FileTree>
{/*
```
root/
├── src/
│   └── mastra/
│       ├── agents/
│       │   └── index.ts
│       ├── tools/
│       │   └── index.ts
│       ├── workflows/
│       │   └── index.ts
│       ├── index.ts
├── .env
├── package.json
├── tssconfig.json
``` */}

### Top-level Folders

| Folder                 | Description                          |
| ---------------------- | ------------------------------------ |
| `src/mastra`           | Core application folder              |
| `src/mastra/agents`    | Agent configurations and definitions |
| `src/mastra/tools`     | Custom tool definitions              |
| `src/mastra/workflows` | Workflow definitions                 |

### Top-level Files

| File                  | Description                                         |
| --------------------- | --------------------------------------------------- |
| `src/mastra/index.ts` | Main configuration file for Mastra                  |
| `.env`                | Environment variables                               |
| `package.json`        | Node.js project metadata, scripts, and dependencies |
| `tsconfig.json`       | TypeScript compiler configuration                   |


---
title: "Getting started with Mastra and Express | Mastra Guides"
description: A step-by-step guide to integrating Mastra with an Express backend.
---

import { Callout, Steps, Tabs, FileTree } from "nextra/components";

# Model Providers
[EN] Source: https://mastra.ai/en/docs/getting-started/model-providers

Model providers are used to interact with different language models. Mastra uses [Vercel's AI SDK](https://sdk.vercel.ai) as a model routing layer to provide a similar syntax for many models:

```typescript showLineNumbers copy {1,7} filename="src/mastra/agents/weather-agent.ts"
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

const agent = new Agent({
  name: "WeatherAgent",
  instructions: "Instructions for the agent...",
  model: openai("gpt-4-turbo"),
});

const result = await agent.generate("What is the weather like?");
```

## Types of AI SDK model providers

Model providers from the AI SDK can be grouped into three main categories:

- [Official providers maintained by the AI SDK team](/docs/getting-started/model-providers#official-providers)
- [OpenAI-compatible providers](/docs/getting-started/model-providers#openai-compatible-providers)
- [Community providers](/docs/getting-started/model-providers#community-providers)

> You can find a list of all available model providers in the [AI SDK documentation](https://ai-sdk.dev/providers/ai-sdk-providers).

<Callout>
AI SDK model providers are packages that need to be installed in your Mastra project.
The default model provider selected during the installation process is installed in the project.

If you want to use a different model provider, you need to install it in your project as well.
</Callout>

Here are some examples of how Mastra agents can be configured to use the different types of model providers:

### Official providers

Official model providers are maintained by the AI SDK team.
Their packages are usually prefixed with `@ai-sdk/`, e.g. `@ai-sdk/anthropic`, `@ai-sdk/openai`, etc.

```typescript showLineNumbers copy {1,7} filename="src/mastra/agents/weather-agent.ts"
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

const agent = new Agent({
  name: "WeatherAgent",
  instructions: "Instructions for the agent...",
  model: openai("gpt-4-turbo"),
});
```

Additional configuration may be done by importing a helper function from the AI SDK provider.
Here's an example using the OpenAI provider:

```typescript showLineNumbers copy filename="src/mastra/agents/weather-agent.ts" {1,4-8,13}
import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent"

const openai = createOpenAI({
    baseUrl: "<your-custom-base-url>",
    apiKey: "<your-custom-api-key>",
    ...otherOptions
});

const agent = new Agent({
    name: "WeatherAgent",
    instructions: "Instructions for the agent...",
    model: openai("<model-name>"),
});
```

### OpenAI-compatible providers

Some language model providers implement the OpenAI API. For these providers, you can use the [`@ai-sdk/openai-compatible`](https://www.npmjs.com/package/@ai-sdk/openai-compatible) provider.

Here's the general setup and provider instance creation:

```typescript showLineNumbers copy filename="src/mastra/agents/weather-agent.ts" {1,4-14,19}
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";

const openaiCompatible = createOpenAICompatible({
    name: "<model-name>",
    baseUrl: "<base-url>",
    apiKey: "<api-key>",
    headers: {},
    queryParams: {},
    fetch: async (url, options) => {
        // custom fetch logic
        return fetch(url, options);
    }
});

const agent = new Agent({
    name: "WeatherAgent",
    instructions: "Instructions for the agent...",
    model: openaiCompatible("<model-name>"),
});
```

For more information on the OpenAI-compatible provider, please refer to the [AI SDK documentation](https://ai-sdk.dev/providers/openai-compatible-providers).

### Community providers

The AI SDK provides a [Language Model Specification](https://github.com/vercel/ai/tree/main/packages/provider/src/language-model/v1).
Following this specification, you can create your own model provider compatible with the AI SDK.

Some community providers have implemented this specification and are compatible with the AI SDK.
We will look at one such provider, the Ollama provider available in the [`ollama-ai-provider`](https://github.com/sgomez/ollama-ai-provider) package.

Here's an example:

```typescript showLineNumbers copy filename="src/mastra/agents/weather-agent.ts" {1,7}
import { ollama } from "ollama-ai-provider";
import { Agent } from "@mastra/core/agent";

const agent = new Agent({
    name: "WeatherAgent",
    instructions: "Instructions for the agent...",
    model: ollama("llama3.2:latest"),
});
```

You can also configure the Ollama provider like so:

```typescript showLineNumbers copy filename="src/mastra/agents/weather-agent.ts" {1,4-7,12}
import { createOllama } from "ollama-ai-provider";
import { Agent } from "@mastra/core/agent";

const ollama = createOllama({
    baseUrl: "<your-custom-base-url>",
    ...otherOptions,
});

const agent = new Agent({
    name: "WeatherAgent",
    instructions: "Instructions for the agent...",
    model: ollama("llama3.2:latest"),
});
```

For more information on the Ollama provider and other available community providers, please refer to the [AI SDK documentation](https://ai-sdk.dev/providers/community-providers).

<Callout>
While this example shows how to use the Ollama provider, other providers like `openrouter`, `azure`, etc. may also be used.
</Callout>

Different AI providers may have different options for configuration. Please refer to the [AI SDK documentation](https://ai-sdk.dev/providers/ai-sdk-providers) for more information.


---
title: "Using with Vercel AI SDK"
description: "Learn how Mastra leverages the Vercel AI SDK library and how you can leverage it further with Mastra"
---

import Image from "next/image";

# Using with Vercel AI SDK
[EN] Source: https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk

Mastra leverages AI SDK's model routing (a unified interface on top of OpenAI, Anthropic, etc), structured output, and tool calling.

We explain this in greater detail in [this blog post](https://mastra.ai/blog/using-ai-sdk-with-mastra)

## Mastra + AI SDK

Mastra acts as a layer on top of AI SDK to help teams productionize their proof-of-concepts quickly and easily.

<Image
  src="/image/mastra-ai-sdk.png"
  alt="Agent interaction trace showing spans, LLM calls, and tool executions"
  style={{ maxWidth: "800px", width: "100%", margin: "8px 0" }}
  className="nextra-image rounded-md py-8"
  data-zoom
  width={800}
  height={400}
/>

## Model routing

When creating agents in Mastra, you can specify any AI SDK-supported model:

```typescript
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

const agent = new Agent({
  name: "WeatherAgent",
  instructions: "Instructions for the agent...",
  model: openai("gpt-4-turbo"), // Model comes directly from AI SDK
});

const result = await agent.generate("What is the weather like?");
```

## AI SDK Hooks

Mastra is compatible with AI SDK's hooks for seamless frontend integration:

### useChat

The `useChat` hook enables real-time chat interactions in your frontend application

- Works with agent data streams i.e. `.toDataStreamResponse()`
- The useChat `api` defaults to `/api/chat`
- Works with the Mastra REST API agent stream endpoint `{MASTRA_BASE_URL}/agents/:agentId/stream` for data streams,
  i.e. no structured output is defined.

```typescript filename="app/api/chat/route.ts" copy
import { mastra } from "@/src/mastra";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  const stream = await myAgent.stream(messages);

  return stream.toDataStreamResponse();
}
```

```typescript copy
import { useChat } from '@ai-sdk/react';

export function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/path-to-your-agent-stream-api-endpoint'
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Say something..."
        />
      </form>
    </div>
  );
}
```

> **Gotcha**: When using `useChat` with agent memory functionality, make sure to check out the [Agent Memory section](/docs/agents/agent-memory#usechat) for important implementation details.

### useCompletion

For single-turn completions, use the `useCompletion` hook:

- Works with agent data streams i.e. `.toDataStreamResponse()`
- The useCompletion `api` defaults to `/api/completion`
- Works with the Mastra REST API agent stream endpoint `{MASTRA_BASE_URL}/agents/:agentId/stream` for data streams,
  i.e. no structured output is defined.

```typescript filename="app/api/completion/route.ts" copy
import { mastra } from "@/src/mastra";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  const stream = await myAgent.stream([{ role: "user", content: prompt }]);

  return stream.toDataStreamResponse();
}
```

```typescript
import { useCompletion } from "@ai-sdk/react";

export function CompletionComponent() {
  const {
    completion,
    input,
    handleInputChange,
    handleSubmit,
  } = useCompletion({
  api: '/path-to-your-agent-stream-api-endpoint'
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Enter a prompt..."
        />
      </form>
      <p>Completion result: {completion}</p>
    </div>
  );
}
```

### useObject

For consuming text streams that represent JSON objects and parsing them into a complete object based on a schema.

- Works with agent text streams i.e. `.toTextStreamResponse()`
- Works with the Mastra REST API agent stream endpoint `{MASTRA_BASE_URL}/agents/:agentId/stream` for text streams,
  i.e. structured output is defined.

```typescript filename="app/api/use-object/route.ts" copy
import { mastra } from "@/src/mastra";

export async function POST(req: Request) {
  const body = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  const stream = await myAgent.stream(body, {
    output: z.object({
      weather: z.string(),
    }),
  });

  return stream.toTextStreamResponse();
}
```

```typescript
import { experimental_useObject as useObject } from '@ai-sdk/react';

export default function Page() {
  const { object, submit } = useObject({
    api: '/api/use-object',
    schema: z.object({
      weather: z.string(),
    }),
  });

  return (
    <div>
      <button onClick={() => submit('example input')}>Generate</button>
      {object?.weather && <p>{object.weather}</p>}
    </div>
  );
}
```

### With additional data / RuntimeContext

You can send additional data via the UI hooks that can be leveraged in Mastra as RuntimeContext using the `sendExtraMessageFields` option.

#### Frontend: Using sendExtraMessageFields

```typescript
import { useChat } from '@ai-sdk/react';

export function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    sendExtraMessageFields: true, // Enable sending extra fields
  });

  const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();        
        handleSubmit(e,{
            // Add context data to the message
            data: {
                userId: 'user123',
                preferences: { language: 'en', temperature: 'celsius' },
            },
        });
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <input value={input} onChange={handleInputChange} />
    </form>
  );
}
```

#### Backend: Handling in API Route

```typescript filename="app/api/chat/route.ts" copy
import { mastra } from "@/src/mastra";
import { RuntimeContext } from "@mastra/core/runtime-context";

export async function POST(req: Request) {
  const { messages, data } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  
  const runtimeContext = new RuntimeContext();
  
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      runtimeContext.set(key, value);
    });
  }
  
  const stream = await myAgent.stream(messages, { runtimeContext });
  return stream.toDataStreamResponse();
}
```

#### Alternative: Server Middleware

You can also handle this at the server middleware level:

```typescript filename="src/mastra/index.ts" copy
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  agents: { weatherAgent },
  server: {
    middleware: [
      async (c, next) => {
        const runtimeContext = c.get("runtimeContext");
        
        if (c.req.method === 'POST') {
          try {
            // Clone the request since reading the body can only be done once
            const clonedReq = c.req.raw.clone();
            const body = await clonedReq.json();
            
            
            if (body?.data) {
              Object.entries(body.data).forEach(([key, value]) => {
                runtimeContext.set(key, value);
              });
            }
          } catch {
            // Continue without additional data
          }
        }
        
        await next();
      },
    ],
  },
});
```

You can then access this data in your tools via the `runtimeContext` parameter. See the [Runtime Context documentation](/docs/agents/runtime-variables) for more details.

## Tool Calling

### AI SDK Tool Format

Mastra supports tools created using the AI SDK format, so you can use
them directly with Mastra agents. See our tools doc on [Vercel AI SDK Tool Format
](/docs/agents/adding-tools#vercel-ai-sdk-tool-format) for more details.

### Client-side tool calling

Mastra leverages AI SDK's tool calling, so what applies in AI SDK applies here still.
[Agent Tools](/docs/agents/adding-tools) in Mastra are 100% percent compatible with AI SDK tools.

Mastra tools also expose an optional `execute` async function. It is optional because you might want to forward tool calls to the client or to a queue instead of executing them in the same process.

One way to then leverage client-side tool calling is to use the `@ai-sdk/react` `useChat` hook's `onToolCall` property for
client-side tool execution

## Custom DataStream

In certain scenarios you need to write custom data, message annotations to an agent's dataStream.
This can be useful for:

- Streaming additional data to the client
- Passing progress info back to the client in real time

Mastra integrates well with AI SDK to make this possible

### CreateDataStream

The `createDataStream` function allows you to stream additional data to the client

```typescript copy
import { createDataStream } from "ai";
import { Agent } from "@mastra/core/agent";

export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: `
          You are a helpful weather assistant that provides accurate weather information.

          Your primary function is to help users get weather details for specific locations. When responding:
          - Always ask for a location if none is provided
          - If the location name isn't in English, please translate it
          - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
          - Include relevant details like humidity, wind conditions, and precipitation
          - Keep responses concise but informative

          Use the weatherTool to fetch current weather data.
    `,
  model: openai("gpt-4o"),
  tools: { weatherTool },
});

const stream = createDataStream({
  async execute(dataStream) {
    // Write data
    dataStream.writeData({ value: "Hello" });

    // Write annotation
    dataStream.writeMessageAnnotation({ type: "status", value: "processing" });

    //mastra agent stream
    const agentStream = await weatherAgent.stream("What is the weather");

    // Merge agent stream
    agentStream.mergeIntoDataStream(dataStream);
  },
  onError: (error) => `Custom error: ${error.message}`,
});
```

### CreateDataStreamResponse

The `createDataStreamResponse` function creates a Response object that streams data to the client

```typescript filename="app/api/chat/route.ts" copy
import { mastra } from "@/src/mastra";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  //mastra agent stream
  const agentStream = await myAgent.stream(messages);

  const response = createDataStreamResponse({
    status: 200,
    statusText: "OK",
    headers: {
      "Custom-Header": "value",
    },
    async execute(dataStream) {
      // Write data
      dataStream.writeData({ value: "Hello" });

      // Write annotation
      dataStream.writeMessageAnnotation({
        type: "status",
        value: "processing",
      });

      // Merge agent stream
      agentStream.mergeIntoDataStream(dataStream);
    },
    onError: (error) => `Custom error: ${error.message}`,
  });

  return response;
}
```


---
title: Using with Assistant UI
description: "Learn how to integrate Assistant UI with Mastra"
---

import { Callout, FileTree, Steps } from 'nextra/components'

## Integration Guide

Run Mastra as a standalone server and connect your Next.js frontend (with Assistant UI) to its API endpoints.

<Steps>
### Create Standalone Mastra Server

Set up your directory structure. A possible directory structure could look like this:

<FileTree>
    <FileTree.Folder name="project-root" defaultOpen>
        <FileTree.Folder name="mastra-server" defaultOpen>
            <FileTree.Folder name="src">
                <FileTree.Folder name="mastra" />
            </FileTree.Folder>
            <FileTree.File name="package.json" />
        </FileTree.Folder>
        <FileTree.Folder name="nextjs-frontend">
            <FileTree.File name="package.json" />
        </FileTree.Folder>
    </FileTree.Folder>
</FileTree>

Bootstrap your Mastra server:

```bash copy
npx create-mastra@latest
```

This command will launch an interactive wizard to help you scaffold a new Mastra project, including prompting you for a project name and setting up basic configurations.
Follow the prompts to create your server project.

You now have a basic Mastra server project ready. You should have the following files and folders:

<FileTree>
    <FileTree.Folder name="src" defaultOpen>
      <FileTree.Folder name="mastra" defaultOpen>
        <FileTree.File name="index.ts" />
        <FileTree.Folder name="agents" defaultOpen>
          <FileTree.File name="weather-agent.ts" />
        </FileTree.Folder>
        <FileTree.Folder name="tools" defaultOpen>
          <FileTree.File name="weather-tool.ts" />
        </FileTree.Folder>
        <FileTree.Folder name="workflows" defaultOpen>
          <FileTree.File name="weather-workflow.ts" />
        </FileTree.Folder>
      </FileTree.Folder>
    </FileTree.Folder>
</FileTree>

<Callout>
Ensure that you have set the appropriate environment variables for your LLM provider in the `.env` file.
</Callout>

### Compatibility Fix

Currently, to ensure proper compatibility between Mastra and Assistant UI, you need to setup server middleware. Update your `/mastra/index.ts` file with the following configuration:

```typescript showLineNumbers copy filename="src/mastra/index.ts"
export const mastra = new Mastra({
  //mastra server middleware
  server:{
  middleware: [{
    path: '/api/agents/*/stream',
    handler: async (c,next)=>{
    
      const body = await c.req.json();
  
      if ('state' in body && body.state == null) {
        delete body.state;
        delete body.tools;
      }
  
       c.req.json = async() => body;
  
      return next()
    }
  }]
 },
});
```

This middleware ensures that when Assistant UI sends a request with `state: null` and `tools: {}` in the request body, we remove those properties to make the request work properly with Mastra.

<Callout type="info">
The `state: null` property can cause errors like `Cannot use 'in' operator to search for 'input' in null` in Mastra. Additionally, passing `tools: {}` overrides Mastra's built-in tools. Mastra only supports `clientTools` via the Mastra client SDK from the client side. For more information about client tools, see the [Client Tools documentation](/reference/client-js/agents#client-tools).
</Callout>

### Run the Mastra Server

Run the Mastra server using the following command:

```bash copy
npm run dev
```

By default, the Mastra server will run on `http://localhost:5000`. Your `weatherAgent` should now be accessible via a POST request endpoint, typically `http://localhost:5000/api/agents/weatherAgent/stream`. Keep this server running for the next steps where we'll set up the Assistant UI frontend to connect to it.

### Initialize Assistant UI

Create a new `assistant-ui` project with the following command.

```bash copy
npx assistant-ui@latest create
```

<Callout>For detailed setup instructions, including adding API keys, basic configuration, and manual setup steps, please refer to [assistant-ui's official documentation](https://assistant-ui.com/docs).</Callout>

### Configure Frontend API Endpoint

The default Assistant UI setup configures the chat runtime to use a local API route (`/api/chat`) within the Next.js project. Since our Mastra agent is running on a separate server, we need to update the frontend to point to that server's endpoint.

Find the `useChatRuntime` hook in the `assistant-ui` project, typically at `app/assistant.tsx` and change the `api` property to the full URL of your Mastra agent's stream endpoint:

```typescript showLineNumbers copy filename="app/assistant.tsx" {2}
const runtime = useChatRuntime({
    api: "http://localhost:5000/api/agents/weatherAgent/stream",
});
```

Now, the Assistant UI frontend will send chat requests directly to your running Mastra server.

### Run the Application

You're ready to connect the pieces! Make sure both the Mastra server and the Assistant UI frontend are running. Start the Next.js development server:

```bash copy
npm run dev
```

You should now be able to chat with your agent in the browser.

</Steps>

Congratulations! You have successfully integrated Mastra with Assistant UI using a separate server approach. Your Assistant UI frontend now communicates with a standalone Mastra agent server.


