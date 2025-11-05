---
title: "mastra dev | Development Server | Mastra CLI"
description: Documentation for the mastra dev command, which starts a development server for agents, tools, and workflows.
---

# mastra dev
[EN] Source: https://mastra.ai/en/reference/cli/dev

The `mastra dev` command starts a development server that exposes REST endpoints for your agents, tools, and workflows.

## Usage

```bash
mastra dev [options]
```

## Options

<PropertiesTable
  content={[
    {
      name: "--dir",
      type: "string",
      description: "Path to your mastra folder",
      isOptional: true,
    },
    {
      name: "--root",
      type: "string",
      description: "Path to your root folder",
      isOptional: true,
    },
    {
      name: "--tools",
      type: "string",
      description: "Comma-separated list of paths to tool files to include",
      isOptional: true,
    },
    {
      name: "--port",
      type: "number",
      description:
        "deprecated: Port number for the development server (defaults to 5000)",
      isOptional: true,
    },
    {
      name: "--env",
      type: "string",
      description: "Path to custom environment file",
      isOptional: true,
    },
    {
      name: "--inspect",
      type: "boolean",
      description: "Start the dev server in inspect mode for debugging (cannot be used with --inspect-brk)",
      isOptional: true,
    },
    {
      name: "--inspect-brk",
      type: "boolean",
      description: "Start the dev server in inspect mode and break at the beginning of the script (cannot be used with --inspect)",
      isOptional: true,
    },
    {
      name: "--help",
      type: "boolean",
      description: "display help for command",
      isOptional: true,
    },
  ]}
/>

## Routes

Starting the server with `mastra dev` exposes a set of REST routes by default:

### System Routes

- **GET `/api`**: Get API status.

### Agent Routes

Agents are expected to be exported from `src/mastra/agents`.

- **GET `/api/agents`**: Lists the registered agents found in your Mastra folder.
- **GET `/api/agents/:agentId`**: Get agent by ID.
- **GET `/api/agents/:agentId/evals/ci`**: Get CI evals by agent ID.
- **GET `/api/agents/:agentId/evals/live`**: Get live evals by agent ID.
- **POST `/api/agents/:agentId/generate`**: Sends a text-based prompt to the specified agent, returning the agent's response.
- **POST `/api/agents/:agentId/stream`**: Stream a response from an agent.
- **POST `/api/agents/:agentId/instructions`**: Update an agent's instructions.
- **POST `/api/agents/:agentId/instructions/enhance`**: Generate an improved system prompt from instructions.
- **GET `/api/agents/:agentId/speakers`**: Get available speakers for an agent.
- **POST `/api/agents/:agentId/speak`**: Convert text to speech using the agent's voice provider.
- **POST `/api/agents/:agentId/listen`**: Convert speech to text using the agent's voice provider.
- **POST `/api/agents/:agentId/tools/:toolId/execute`**: Execute a tool through an agent.

### Tool Routes

Tools are expected to be exported from `src/mastra/tools` (or the configured tools directory).

- **GET `/api/tools`**: Get all tools.
- **GET `/api/tools/:toolId`**: Get tool by ID.
- **POST `/api/tools/:toolId/execute`**: Invokes a specific tool by name, passing input data in the request body.

### Workflow Routes

Workflows are expected to be exported from `src/mastra/workflows` (or the configured workflows directory).

- **GET `/api/workflows`**: Get all workflows.
- **GET `/api/workflows/:workflowId`**: Get workflow by ID.
- **POST `/api/workflows/:workflowName/start`**: Starts the specified workflow.
- **POST `/api/workflows/:workflowName/:instanceId/event`**: Sends an event or trigger signal to an existing workflow instance.
- **GET `/api/workflows/:workflowName/:instanceId/status`**: Returns status info for a running workflow instance.
- **POST `/api/workflows/:workflowId/resume`**: Resume a suspended workflow step.
- **POST `/api/workflows/:workflowId/resume-async`**: Resume a suspended workflow step asynchronously.
- **POST `/api/workflows/:workflowId/createRun`**: Create a new workflow run.
- **POST `/api/workflows/:workflowId/start-async`**: Execute/Start a workflow asynchronously.
- **GET `/api/workflows/:workflowId/watch`**: Watch workflow transitions in real-time.

### Memory Routes

- **GET `/api/memory/status`**: Get memory status.
- **GET `/api/memory/threads`**: Get all threads.
- **GET `/api/memory/threads/:threadId`**: Get thread by ID.
- **GET `/api/memory/threads/:threadId/messages`**: Get messages for a thread.
- **POST `/api/memory/threads`**: Create a new thread.
- **PATCH `/api/memory/threads/:threadId`**: Update a thread.
- **DELETE `/api/memory/threads/:threadId`**: Delete a thread.
- **POST `/api/memory/save-messages`**: Save messages.

### Telemetry Routes

- **GET `/api/telemetry`**: Get all traces.

### Log Routes

- **GET `/api/logs`**: Get all logs.
- **GET `/api/logs/transports`**: List of all log transports.
- **GET `/api/logs/:runId`**: Get logs by run ID.

### Vector Routes

- **POST `/api/vector/:vectorName/upsert`**: Upsert vectors into an index.
- **POST `/api/vector/:vectorName/create-index`**: Create a new vector index.
- **POST `/api/vector/:vectorName/query`**: Query vectors from an index.
- **GET `/api/vector/:vectorName/indexes`**: List all indexes for a vector store.
- **GET `/api/vector/:vectorName/indexes/:indexName`**: Get details about a specific index.
- **DELETE `/api/vector/:vectorName/indexes/:indexName`**: Delete a specific index.

### OpenAPI Specification

- **GET `/openapi.json`**: Returns an auto-generated OpenAPI specification for your project's routes.
- **GET `/swagger-ui`**: Access Swagger UI for API documentation.

## Additional Notes

The port defaults to 5000. Both the port and hostname can be configured via the mastra server config. See [Launch Development Server](/docs/server-db/local-dev-playground) for configuration details.

Make sure you have your environment variables set up in your `.env.development` or `.env` file for any providers you use (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).

Make sure the `index.ts` file in your Mastra folder exports the Mastra instance for the dev server to read.

### Example request

To test an agent after running `mastra dev`:

```bash copy
curl -X POST http://localhost:5000/api/agents/myAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Hello, how can you assist me today?" }
    ]
  }'
```

## Advanced usage

The `mastra dev` server obeys a few extra environment variables that can
be handy during development:

### Disable build caching

Set `MASTRA_DEV_NO_CACHE=1` to force a full rebuild rather than using
the cached assets under `.mastra/`:

```bash copy
MASTRA_DEV_NO_CACHE=1 mastra dev
```

This helps when you are debugging bundler plugins or suspect stale
output.

### Limit parallelism

`MASTRA_CONCURRENCY` caps how many expensive operations run in parallel
(primarily build and evaluation steps). For example:

```bash copy
MASTRA_CONCURRENCY=4 mastra dev
```

Leave it unset to let the CLI pick a sensible default for the machine.

### Custom provider endpoints

When using providers supported by the Vercel AI SDK you can redirect
requests through proxies or internal gateways by setting a base URL. For
OpenAI:

```bash copy
OPENAI_API_KEY=<your-api-key> \
OPENAI_BASE_URL=https://openrouter.example/v1 \
mastra dev
```

and for Anthropic:

```bash copy
OPENAI_API_KEY=<your-api-key> \
ANTHROPIC_BASE_URL=https://anthropic.internal \
mastra dev
```

These are forwarded by the AI SDK and work with any `openai()` or
`anthropic()` calls.

### Disable telemetry

To opt out of anonymous CLI analytics set
`MASTRA_TELEMETRY_DISABLED=1`. This also prevents tracking within the
local playground.

```bash copy
MASTRA_TELEMETRY_DISABLED=1 mastra dev
```


---
title: "mastra lint | Validate Project | Mastra CLI"
description: "Lint your Mastra project"
---

# mastra lint
[EN] Source: https://mastra.ai/en/reference/cli/lint

The `mastra lint` command validates the structure and code of your Mastra project to ensure it follows best practices and is error-free.

## Usage

```bash
mastra lint [options]
```

## Options

<PropertiesTable
  content={[
    {
      name: "--dir",
      type: "string",
      description: "Path to your Mastra folder",
      isOptional: true,
    },
    {
      name: "--root",
      type: "string",
      description: "Path to your root folder",
      isOptional: true,
    },
    {
      name: "--tools",
      type: "string",
      description: "Comma-separated list of paths to tool files to include",
      isOptional: true,
    },
    {
      name: "--help",
      type: "boolean",
      description: "display help for command",
      isOptional: true,
    },
  ]}
/>

## Advanced usage

### Disable telemetry

To disable CLI analytics while running linting (and other commands) set
`MASTRA_TELEMETRY_DISABLED=1`:

```bash copy
MASTRA_TELEMETRY_DISABLED=1 mastra lint
```


---
title: 'mastra start'
description: 'Start your built Mastra application'
---

# mastra start
[EN] Source: https://mastra.ai/en/reference/cli/start

Start your built Mastra application. This command is used to run your built Mastra application in production mode.
Telemetry is enabled by default.

## Usage
After building your project with `mastra build` run:

```bash
mastra start [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-d, --dir <path>` | Path to your built Mastra output directory (default: .mastra/output) |
| `-nt, --no-telemetry` | Enable OpenTelemetry instrumentation for observability |

## Examples

Start the application with default settings:

```bash
mastra start
```

Start from a custom output directory:

```bash
mastra start --dir ./my-output
```

Start with telemetry disabled:

```bash
mastra start -nt
```

---
title: Mastra Client Agents API
description: Learn how to interact with Mastra AI agents, including generating responses, streaming interactions, and managing agent tools using the client-js SDK.
---

# Agents API
[EN] Source: https://mastra.ai/en/reference/client-js/agents

The Agents API provides methods to interact with Mastra AI agents, including generating responses, streaming interactions, and managing agent tools.

## Initialize Mastra Client

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient();
```

## Getting All Agents

Retrieve a list of all available agents:

```typescript
const agents = await client.getAgents();
```

## Working with a Specific Agent

Get an instance of a specific agent:

```typescript
const agent = client.getAgent("agent-id");
```

## Agent Methods

### Get Agent Details

Retrieve detailed information about an agent:

```typescript
const details = await agent.details();
```

### Generate Response

Generate a response from the agent:

```typescript
const response = await agent.generate({
  messages: [
    {
      role: "user",
      content: "Hello, how are you?",
    },
  ],
  threadId: "thread-1", // Optional: Thread ID for conversation context
  resourceid: "resource-1", // Optional: Resource ID
  output: {}, // Optional: Output configuration
});
```

### Stream Response

Stream responses from the agent for real-time interactions:

```typescript
const response = await agent.stream({
  messages: [
    {
      role: "user",
      content: "Tell me a story",
    },
  ],
});

// Process data stream with the processDataStream util
response.processDataStream({
  onTextPart: (text) => {
    process.stdout.write(text);
  },
  onFilePart: (file) => {
    console.log(file);
  },
  onDataPart: (data) => {
    console.log(data);
  },
  onErrorPart: (error) => {
    console.error(error);
  },
});

// Process text stream with the processTextStream util 
// (used with structured output)
 response.processTextStream({
      onTextPart: text => {
        process.stdout.write(text);
      },
});

// You can also read from response body directly
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

### Client tools

Client-side tools allow you to execute custom functions on the client side when the agent requests them.

#### Basic Usage

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const colorChangeTool = createTool({
  id: 'changeColor',
  description: 'Changes the background color',
  inputSchema: z.object({
    color: z.string(),
  }),
  execute: async ({ context }) => {
    document.body.style.backgroundColor = context.color;
    return { success: true };
  }
})


// Use with generate
const response = await agent.generate({
  messages: 'Change the background to blue',
  clientTools: {colorChangeTool},
});

// Use with stream
const response = await agent.stream({
  messages: 'Change the background to green',
  clientTools: {colorChangeTool},
});

response.processDataStream({
  onTextPart: (text) => console.log(text),
  onToolCallPart: (toolCall) => console.log('Tool called:', toolCall.toolName),
});
```

### Get Agent Tool

Retrieve information about a specific tool available to the agent:

```typescript
const tool = await agent.getTool("tool-id");
```

### Get Agent Evaluations

Get evaluation results for the agent:

```typescript
// Get CI evaluations
const evals = await agent.evals();

// Get live evaluations
const liveEvals = await agent.liveEvals();
```


---
title: Mastra Client Error Handling
description: Learn about the built-in retry mechanism and error handling capabilities in the Mastra client-js SDK.
---

# Error Handling
[EN] Source: https://mastra.ai/en/reference/client-js/error-handling

The Mastra Client SDK includes built-in retry mechanism and error handling capabilities.

## Error Handling

All API methods can throw errors that you can catch and handle:

```typescript
try {
  const agent = client.getAgent("agent-id");
  const response = await agent.generate({
    messages: [{ role: "user", content: "Hello" }],
  });
} catch (error) {
  console.error("An error occurred:", error.message);
}
```

## Retry Mechanism

The client automatically retries failed requests with exponential backoff:

```typescript
const client = new MastraClient({
  baseUrl: "http://localhost:5000",
  retries: 3, // Number of retry attempts
  backoffMs: 300, // Initial backoff time
  maxBackoffMs: 5000, // Maximum backoff time
});
```

### How Retries Work

1. First attempt fails → Wait 300ms
2. Second attempt fails → Wait 600ms
3. Third attempt fails → Wait 1200ms
4. Final attempt fails → Throw error


---
title: Mastra Client Logs API
description: Learn how to access and query system logs and debugging information in Mastra using the client-js SDK.
---

# Logs API
[EN] Source: https://mastra.ai/en/reference/client-js/logs

The Logs API provides methods to access and query system logs and debugging information in Mastra.

## Initialize Mastra Client

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient();
```

## Getting Logs

Retrieve system logs with optional filtering:

```typescript
const logs = await client.getLogs({
  transportId: "transport-1",
});
```

## Getting Logs for a Specific Run

Retrieve logs for a specific execution run:

```typescript
const runLogs = await client.getLogForRun({
  runId: "run-1",
  transportId: "transport-1",
});
```


---
title: Mastra Client Telemetry API
description: Learn how to retrieve and analyze traces from your Mastra application for monitoring and debugging using the client-js SDK.
---

# Telemetry API
[EN] Source: https://mastra.ai/en/reference/client-js/telemetry

The Telemetry API provides methods to retrieve and analyze traces from your Mastra application. This helps you monitor and debug your application's behavior and performance.

## Initialize Mastra Client

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient();
```

## Getting Traces

Retrieve traces with optional filtering and pagination:

```typescript
const telemetry = await client.getTelemetry({
  name: "trace-name", // Optional: Filter by trace name
  scope: "scope-name", // Optional: Filter by scope
  page: 1, // Optional: Page number for pagination
  perPage: 10, // Optional: Number of items per page
  attribute: {
    // Optional: Filter by custom attributes
    key: "value",
  },
});
```


---
title: Mastra Client Tools API
description: Learn how to interact with and execute tools available in the Mastra platform using the client-js SDK.
---

# Tools API
[EN] Source: https://mastra.ai/en/reference/client-js/tools

The Tools API provides methods to interact with and execute tools available in the Mastra platform.

## Initialize Mastra Client

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient();
```

## Getting All Tools

Retrieve a list of all available tools:

```typescript
const tools = await client.getTools();
```

## Working with a Specific Tool

Get an instance of a specific tool:

```typescript
const tool = client.getTool("tool-id");
```

## Tool Methods

### Get Tool Details

Retrieve detailed information about a tool:

```typescript
const details = await tool.details();
```

### Execute Tool

Execute a tool with specific arguments:

```typescript
const result = await tool.execute({
  args: {
    param1: "value1",
    param2: "value2",
  },
  threadId: "thread-1", // Optional: Thread context
  resourceid: "resource-1", // Optional: Resource identifier
});
```


---
title: Mastra Client Vectors API
description: Learn how to work with vector embeddings for semantic search and similarity matching in Mastra using the client-js SDK.
---

# Vectors API
[EN] Source: https://mastra.ai/en/reference/client-js/vectors

The Vectors API provides methods to work with vector embeddings for semantic search and similarity matching in Mastra.

## Initialize Mastra Client

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient();
```

## Working with Vectors

Get an instance of a vector store:

```typescript
const vector = client.getVector("vector-name");
```

## Vector Methods

### Get Vector Index Details

Retrieve information about a specific vector index:

```typescript
const details = await vector.details("index-name");
```

### Create Vector Index

Create a new vector index:

```typescript
const result = await vector.createIndex({
  indexName: "new-index",
  dimension: 128,
  metric: "cosine", // 'cosine', 'euclidean', or 'dotproduct'
});
```

### Upsert Vectors

Add or update vectors in an index:

```typescript
const ids = await vector.upsert({
  indexName: "my-index",
  vectors: [
    [0.1, 0.2, 0.3], // First vector
    [0.4, 0.5, 0.6], // Second vector
  ],
  metadata: [{ label: "first" }, { label: "second" }],
  ids: ["id1", "id2"], // Optional: Custom IDs
});
```

### Query Vectors

Search for similar vectors:

```typescript
const results = await vector.query({
  indexName: "my-index",
  queryVector: [0.1, 0.2, 0.3],
  topK: 10,
  filter: { label: "first" }, // Optional: Metadata filter
  includeVector: true, // Optional: Include vectors in results
});
```

### Get All Indexes

List all available indexes:

```typescript
const indexes = await vector.getIndexes();
```

### Delete Index

Delete a vector index:

```typescript
const result = await vector.delete("index-name");
```


---
title: Mastra Client Workflows (Legacy) API
description: Learn how to interact with and execute automated legacy workflows in Mastra using the client-js SDK.
---

# Workflows (Legacy) API
[EN] Source: https://mastra.ai/en/reference/client-js/workflows-legacy

The Workflows (Legacy) API provides methods to interact with and execute automated legacy workflows in Mastra.

## Initialize Mastra Client

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient();
```

## Getting All Legacy Workflows

Retrieve a list of all available legacy workflows:

```typescript
const workflows = await client.getLegacyWorkflows();
```

## Working with a Specific Legacy Workflow

Get an instance of a specific legacy workflow:

```typescript
const workflow = client.getLegacyWorkflow("workflow-id");
```

## Legacy Workflow Methods

### Get Legacy Workflow Details

Retrieve detailed information about a legacy workflow:

```typescript
const details = await workflow.details();
```

### Start Legacy Workflow run asynchronously

Start a legacy workflow run with triggerData and await full run results:

```typescript
const { runId } = workflow.createRun();

const result = await workflow.startAsync({
  runId,
  triggerData: {
    param1: "value1",
    param2: "value2",
  },
});
```

### Resume Legacy Workflow run asynchronously

Resume a suspended legacy workflow step and await full run result:

```typescript
const { runId } = createRun({ runId: prevRunId });

const result = await workflow.resumeAsync({
  runId,
  stepId: "step-id",
  contextData: { key: "value" },
});
```

### Watch Legacy Workflow

Watch legacy workflow transitions

```typescript
try {
  // Get workflow instance
  const workflow = client.getLegacyWorkflow("workflow-id");

  // Create a workflow run
  const { runId } = workflow.createRun();

  // Watch workflow run
  workflow.watch({ runId }, (record) => {
    // Every new record is the latest transition state of the workflow run

    console.log({
      activePaths: record.activePaths,
      results: record.results,
      timestamp: record.timestamp,
      runId: record.runId,
    });
  });

  // Start workflow run
  workflow.start({
    runId,
    triggerData: {
      city: "New York",
    },
  });
} catch (e) {
  console.error(e);
}
```

### Resume Legacy Workflow

Resume legacy workflow run and watch legacy workflow step transitions

```typescript
try {
  //To resume a workflow run, when a step is suspended
  const { run } = createRun({ runId: prevRunId });

  //Watch run
  workflow.watch({ runId }, (record) => {
    // Every new record is the latest transition state of the workflow run

    console.log({
      activePaths: record.activePaths,
      results: record.results,
      timestamp: record.timestamp,
      runId: record.runId,
    });
  });

  //resume run
  workflow.resume({
    runId,
    stepId: "step-id",
    contextData: { key: "value" },
  });
} catch (e) {
  console.error(e);
}
```

### Legacy Workflow run result

A legacy workflow run result yields the following:

| Field         | Type                                                                           | Description                                                        |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `activePaths` | `Record<string, { status: string; suspendPayload?: any; stepPath: string[] }>` | Currently active paths in the workflow with their execution status |
| `results`     | `LegacyWorkflowRunResult<any, any, any>['results']`                            | Results from the workflow execution                                |
| `timestamp`   | `number`                                                                       | Unix timestamp of when this transition occurred                    |
| `runId`       | `string`                                                                       | Unique identifier for this workflow run instance                   |


---
title: Mastra Client Workflows API
description: Learn how to interact with and execute automated workflows in Mastra using the client-js SDK.
---

# Workflows API
[EN] Source: https://mastra.ai/en/reference/client-js/workflows

The Workflows API provides methods to interact with and execute automated workflows in Mastra.

## Initialize Mastra Client

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient();
```

## Getting All Workflows

Retrieve a list of all available workflows:

```typescript
const workflows = await client.getWorkflows();
```

## Working with a Specific Workflow

Get an instance of a specific workflow as defined by the const name:

```typescript filename="src/mastra/workflows/test-workflow.ts"
export const testWorkflow = createWorkflow({
  id: 'city-workflow'
})
```

```typescript
const workflow = client.getWorkflow("testWorkflow");
```

## Workflow Methods

### Get Workflow Details

Retrieve detailed information about a workflow:

```typescript
const details = await workflow.details();
```

### Start workflow run asynchronously

Start a workflow run with inputData and await full run results:

```typescript
const run = await workflow.createRun();

const result = await workflow.startAsync({
  runId: run.runId,
  inputData: {
    city: "New York",
  },
});
```

### Resume Workflow run asynchronously

Resume a suspended workflow step and await full run result:

```typescript
const run = await workflow.createRun();

const result = await workflow.resumeAsync({
  runId: run.runId,
  step: "step-id",
  resumeData: { key: "value" },
});
```

### Watch Workflow

Watch workflow transitions:

```typescript
try {
  const workflow = client.getWorkflow("testWorkflow");

  const run = await workflow.createRun();

  workflow.watch({ runId: run.runId }, (record) => {
    console.log(record);
  });

  const result = await workflow.start({
    runId: run.runId,
    inputData: {
      city: "New York",
    },
  });
} catch (e) {
  console.error(e);
}
```

### Resume Workflow

Resume workflow run and watch workflow step transitions:

```typescript
try {
  const workflow = client.getWorkflow("testWorkflow");

  const run = await workflow.createRun({ runId: prevRunId });

  workflow.watch({ runId: run.runId }, (record) => {
    console.log(record);
  });

  workflow.resume({
    runId: run.runId,
    step: "step-id",
    resumeData: { key: "value" },
  });
} catch (e) {
  console.error(e);
}
```

### Get Workflow Run result

Get the result of a workflow run:

```typescript
try  {
  const workflow = client.getWorkflow("testWorkflow");

  const run = await workflow.createRun();

  // start the workflow run
  const startResult = await workflow.start({
    runId: run.runId,
    inputData: {
      city: "New York",
    },
  });

  const result = await workflow.runExecutionResult(run.runId);

  console.log(result);
} catch (e) {
  console.error(e);
}
```

This is useful when dealing with long running workflows. You can use this to poll the result of the workflow run.

### Workflow run result

A workflow run result yields the following:

| Field            | Type                                                                                                                                                                                                                                               | Description                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `payload`        | `{currentStep?: {id: string, status: string, output?: Record<string, any>, payload?: Record<string, any>}, workflowState: {status: string, steps: Record<string, {status: string, output?: Record<string, any>, payload?: Record<string, any>}>}}` | The current step and workflow state of the run   |
| `eventTimestamp` | `Date`                                                                                                                                                                                                                                             | The timestamp of the event                       |
| `runId`          | `string`                                                                                                                                                                                                                                           | Unique identifier for this workflow run instance |


---
title: "Reference: MCPClient | Tool Management | Mastra Docs"
description: API Reference for MCPClient - A class for managing multiple Model Context Protocol servers and their tools.
---

# createVectorQueryTool()
[EN] Source: https://mastra.ai/en/reference/tools/vector-query-tool

The `createVectorQueryTool()` function creates a tool for semantic search over vector stores. It supports filtering, reranking, database-specific configurations, and integrates with various vector store backends.

## Basic Usage

```typescript
import { openai } from "@ai-sdk/openai";
import { createVectorQueryTool } from "@mastra/rag";

const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding("text-embedding-3-small"),
});
```

## Parameters

<Callout>
  **Parameter Requirements:** Most fields can be set at creation as defaults.
  Some fields can be overridden at runtime via the runtime context or input. If
  a required field is missing from both creation and runtime, an error will be
  thrown. Note that `model`, `id`, and `description` can only be set at creation
  time.
</Callout>

<PropertiesTable
  content={[
    {
      name: "id",
      type: "string",
      description:
        "Custom ID for the tool. By default: 'VectorQuery {vectorStoreName} {indexName} Tool'. (Set at creation only.)",
      isOptional: true,
    },
    {
      name: "description",
      type: "string",
      description:
        "Custom description for the tool. By default: 'Access the knowledge base to find information needed to answer user questions' (Set at creation only.)",
      isOptional: true,
    },
    {
      name: "model",
      type: "EmbeddingModel",
      description:
        "Embedding model to use for vector search. (Set at creation only.)",
      isOptional: false,
    },
    {
      name: "vectorStoreName",
      type: "string",
      description:
        "Name of the vector store to query. (Can be set at creation or overridden at runtime.)",
      isOptional: false,
    },
    {
      name: "indexName",
      type: "string",
      description:
        "Name of the index within the vector store. (Can be set at creation or overridden at runtime.)",
      isOptional: false,
    },
    {
      name: "enableFilter",
      type: "boolean",
      description:
        "Enable filtering of results based on metadata. (Set at creation only, but will be automatically enabled if a filter is provided in the runtime context.)",
      isOptional: true,
      defaultValue: "false",
    },
    {
      name: "includeVectors",
      type: "boolean",
      description:
        "Include the embedding vectors in the results. (Can be set at creation or overridden at runtime.)",
      isOptional: true,
      defaultValue: "false",
    },
    {
      name: "includeSources",
      type: "boolean",
      description:
        "Include the full retrieval objects in the results. (Can be set at creation or overridden at runtime.)",
      isOptional: true,
      defaultValue: "true",
    },
    {
      name: "reranker",
      type: "RerankConfig",
      description:
        "Options for reranking results. (Can be set at creation or overridden at runtime.)",
      isOptional: true,
    },
    {
      name: "databaseConfig",
      type: "DatabaseConfig",
      description:
        "Database-specific configuration options for optimizing queries. (Can be set at creation or overridden at runtime.)",
      isOptional: true,
    },
  ]}
/>

### DatabaseConfig

The `DatabaseConfig` type allows you to specify database-specific configurations that are automatically applied to query operations. This enables you to take advantage of unique features and optimizations offered by different vector stores.

<PropertiesTable
  content={[
    {
      name: "pinecone",
      type: "PineconeConfig",
      description: "Configuration specific to Pinecone vector store",
      isOptional: true,
      properties: [
        {
          type: "object",
          parameters: [
            {
              name: "namespace",
              description: "Pinecone namespace for organizing vectors",
              isOptional: true,
              type: "string",
            },
            {
              name: "sparseVector",
              description: "Sparse vector for hybrid search",
              isOptional: true,
              type: "{ indices: number[]; values: number[]; }",
            },
          ],
        },
      ],
    },
    {
      name: "pgvector",
      type: "PgVectorConfig",
      description: "Configuration specific to PostgreSQL with pgvector extension",
      isOptional: true,
      properties: [
        {
          type: "object",
          parameters: [
            {
              name: "minScore",
              description: "Minimum similarity score threshold for results",
              isOptional: true,
              type: "number",
            },
            {
              name: "ef",
              description: "HNSW search parameter - controls accuracy vs speed tradeoff",
              isOptional: true,
              type: "number",
            },
            {
              name: "probes",
              description: "IVFFlat probe parameter - number of cells to visit during search",
              isOptional: true,
              type: "number",
            },
          ],
        },
      ],
    },
    {
      name: "chroma",
      type: "ChromaConfig",
      description: "Configuration specific to Chroma vector store",
      isOptional: true,
      properties: [
        {
          type: "object",
          parameters: [
            {
              name: "where",
              description: "Metadata filtering conditions",
              isOptional: true,
              type: "Record<string, any>",
            },
            {
              name: "whereDocument",
              description: "Document content filtering conditions",
              isOptional: true,
              type: "Record<string, any>",
            },
          ],
        },
      ],
    },
  ]}
/>

### RerankConfig

<PropertiesTable
  content={[
    {
      name: "model",
      type: "MastraLanguageModel",
      description: "Language model to use for reranking",
      isOptional: false,
    },
    {
      name: "options",
      type: "RerankerOptions",
      description: "Options for the reranking process",
      isOptional: true,
      properties: [
        {
          type: "object",
          parameters: [
            {
              name: "weights",
              description:
                "Weights for scoring components (semantic: 0.4, vector: 0.4, position: 0.2)",
              isOptional: true,
              type: "WeightConfig",
            },
            {
              name: "topK",
              description: "Number of top results to return",
              isOptional: true,
              type: "number",
              defaultValue: "3",
            },
          ],
        },
      ],
    },
  ]}
/>

## Returns

The tool returns an object with:

<PropertiesTable
  content={[
    {
      name: "relevantContext",
      type: "string",
      description: "Combined text from the most relevant document chunks",
    },
    {
      name: "sources",
      type: "QueryResult[]",
      description:
        "Array of full retrieval result objects. Each object contains all information needed to reference the original document, chunk, and similarity score.",
    },
  ]}
/>

### QueryResult object structure

```typescript
{
  id: string;         // Unique chunk/document identifier
  metadata: any;      // All metadata fields (document ID, etc.)
  vector: number[];   // Embedding vector (if available)
  score: number;      // Similarity score for this retrieval
  document: string;   // Full chunk/document text (if available)
}
```

## Default Tool Description

The default description focuses on:

- Finding relevant information in stored knowledge
- Answering user questions
- Retrieving factual content

## Result Handling

The tool determines the number of results to return based on the user's query, with a default of 10 results. This can be adjusted based on the query requirements.

## Example with Filters

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding("text-embedding-3-small"),
  enableFilter: true,
});
```

With filtering enabled, the tool processes queries to construct metadata filters that combine with semantic search. The process works as follows:

1. A user makes a query with specific filter requirements like "Find content where the 'version' field is greater than 2.0"
2. The agent analyzes the query and constructs the appropriate filters:
   ```typescript
   {
      "version": { "$gt": 2.0 }
   }
   ```

This agent-driven approach:

- Processes natural language queries into filter specifications
- Implements vector store-specific filter syntax
- Translates query terms to filter operators

For detailed filter syntax and store-specific capabilities, see the [Metadata Filters](../rag/metadata-filters) documentation.

For an example of how agent-driven filtering works, see the [Agent-Driven Metadata Filtering](../../../examples/rag/usage/filter-rag) example.

## Example with Reranking

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: "milvus",
  indexName: "documentation",
  model: openai.embedding("text-embedding-3-small"),
  reranker: {
    model: openai("gpt-4o-mini"),
    options: {
      weights: {
        semantic: 0.5, // Semantic relevance weight
        vector: 0.3, // Vector similarity weight
        position: 0.2, // Original position weight
      },
      topK: 5,
    },
  },
});
```

Reranking improves result quality by combining:

- Semantic relevance: Using LLM-based scoring of text similarity
- Vector similarity: Original vector distance scores
- Position bias: Consideration of original result ordering
- Query analysis: Adjustments based on query characteristics

The reranker processes the initial vector search results and returns a reordered list optimized for relevance.

## Example with Custom Description

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding("text-embedding-3-small"),
  description:
    "Search through document archives to find relevant information for answering questions about company policies and procedures",
});
```

This example shows how to customize the tool description for a specific use case while maintaining its core purpose of information retrieval.

## Database-Specific Configuration Examples

The `databaseConfig` parameter allows you to leverage unique features and optimizations specific to each vector database. These configurations are automatically applied during query execution.

<Tabs items={['Pinecone', 'pgVector', 'Chroma', 'Multiple Configs']}>
  <Tabs.Tab>
    ### Pinecone Configuration

    ```typescript
    const pineconeQueryTool = createVectorQueryTool({
      vectorStoreName: "pinecone",
      indexName: "docs",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pinecone: {
          namespace: "production",  // Organize vectors by environment
          sparseVector: {          // Enable hybrid search
            indices: [0, 1, 2, 3],
            values: [0.1, 0.2, 0.15, 0.05]
          }
        }
      }
    });
    ```

    **Pinecone Features:**
    - **Namespace**: Isolate different data sets within the same index
    - **Sparse Vector**: Combine dense and sparse embeddings for improved search quality
    - **Use Cases**: Multi-tenant applications, hybrid semantic search
  </Tabs.Tab>

  <Tabs.Tab>
    ### pgVector Configuration

    ```typescript
    const pgVectorQueryTool = createVectorQueryTool({
      vectorStoreName: "postgres",
      indexName: "embeddings",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pgvector: {
          minScore: 0.7,    // Only return results above 70% similarity
          ef: 200,          // Higher value = better accuracy, slower search
          probes: 10        // For IVFFlat: more probes = better recall
        }
      }
    });
    ```

    **pgVector Features:**
    - **minScore**: Filter out low-quality matches
    - **ef (HNSW)**: Control accuracy vs speed for HNSW indexes
    - **probes (IVFFlat)**: Control recall vs speed for IVFFlat indexes
    - **Use Cases**: Performance tuning, quality filtering
  </Tabs.Tab>

  <Tabs.Tab>
    ### Chroma Configuration

    ```typescript
    const chromaQueryTool = createVectorQueryTool({
      vectorStoreName: "chroma",
      indexName: "documents",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        chroma: {
          where: {                    // Metadata filtering
            "category": "technical",
            "status": "published"
          },
          whereDocument: {            // Document content filtering
            "$contains": "API"
          }
        }
      }
    });
    ```

    **Chroma Features:**
    - **where**: Filter by metadata fields
    - **whereDocument**: Filter by document content
    - **Use Cases**: Advanced filtering, content-based search
  </Tabs.Tab>

  <Tabs.Tab>
    ### Multiple Database Configurations

    ```typescript
    // Configure for multiple databases (useful for dynamic stores)
    const multiDbQueryTool = createVectorQueryTool({
      vectorStoreName: "dynamic-store", // Will be set at runtime
      indexName: "docs",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pinecone: {
          namespace: "default"
        },
        pgvector: {
          minScore: 0.8,
          ef: 150
        },
        chroma: {
          where: { "type": "documentation" }
        }
      }
    });
    ```

    **Multi-Config Benefits:**
    - Support multiple vector stores with one tool
    - Database-specific optimizations are automatically applied
    - Flexible deployment scenarios
  </Tabs.Tab>
</Tabs>

### Runtime Configuration Override

You can override database configurations at runtime to adapt to different scenarios:

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';

const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding("text-embedding-3-small"),
  databaseConfig: {
    pinecone: {
      namespace: "development"
    }
  }
});

// Override at runtime
const runtimeContext = new RuntimeContext();
runtimeContext.set('databaseConfig', {
  pinecone: {
    namespace: 'production'  // Switch to production namespace
  }
});

const response = await agent.generate(
  "Find information about deployment",
  { runtimeContext }
);
```

This approach allows you to:
- Switch between environments (dev/staging/prod)
- Adjust performance parameters based on load
- Apply different filtering strategies per request

## Example: Using Runtime Context

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding("text-embedding-3-small"),
});
```

When using runtime context, provide required parameters at execution time via the runtime context:

```typescript
const runtimeContext = new RuntimeContext<{
  vectorStoreName: string;
  indexName: string;
  topK: number;
  filter: VectorFilter;
  databaseConfig: DatabaseConfig;
}>();
runtimeContext.set("vectorStoreName", "my-store");
runtimeContext.set("indexName", "my-index");
runtimeContext.set("topK", 5);
runtimeContext.set("filter", { category: "docs" });
runtimeContext.set("databaseConfig", {
  pinecone: { namespace: "runtime-namespace" }
});
runtimeContext.set("model", openai.embedding("text-embedding-3-small"));

const response = await agent.generate(
  "Find documentation from the knowledge base.",
  {
    runtimeContext,
  },
);
```

For more information on runtime context, please see:

- [Runtime Variables](../../docs/agents/runtime-variables)
- [Dynamic Context](../../docs/tools-mcp/dynamic-context)

## Tool Details

The tool is created with:

- **ID**: `VectorQuery {vectorStoreName} {indexName} Tool`
- **Input Schema**: Requires queryText and filter objects
- **Output Schema**: Returns relevantContext string

## Related

- [rerank()](../rag/rerank)
- [createGraphRAGTool](./graph-rag-tool)


