---
title: "Example: Array as Input (.foreach()) | Workflows | Mastra Docs"
description: Example of using Mastra to process an array using .foreach() in a workflow.
---

# Array as Input
[EN] Source: https://mastra.ai/en/examples/workflows/array-as-input

This example demonstrates how to process an array input in a workflow. Mastra provides a `.foreach()` helper function that executes a step for each item in the array.

## Setup

```sh copy
npm install @ai-sdk/openai @mastra/core simple-git
```

## Define Docs Generator Agent

Define a docs generator agent that leverages an LLM call to generate a documentation given a code file or a summary of a code file.

```ts showLineNumbers copy filename="agents/docs-generator-agent.ts"
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// Create a documentation generator agent for code analysis
const docGeneratorAgent = new Agent({
  name: "doc_generator_agent",
  instructions: `You are a technical documentation expert. You will analyze the provided code files and generate a comprehensive documentation summary.
            For each file:
            1. Identify the main purpose and functionality
            2. Document key components, classes, functions, and interfaces
            3. Note important dependencies and relationships between components
            4. Highlight any notable patterns or architectural decisions
            5. Include relevant code examples where helpful

            Format the documentation in a clear, organized manner using markdown with:
            - File overviews
            - Component breakdowns
            - Code examples
            - Cross-references between related components

            Focus on making the documentation clear and useful for developers who need to understand and work with this codebase.`,
  model: openai("gpt-4o"),
});

export { docGeneratorAgent };
```

## Define File Summary Workflow

Define the file summary workflow with 2 steps: one to fetch the code of a particular file and another to generate a readme for that particular code file.

```ts showLineNumbers copy filename="workflows/file-summary-workflow.ts"
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { docGeneratorAgent } from "../agents/docs-generator-agent";
import { z } from "zod";
import fs from "fs";

// Step 1: Read the code content from a file
const scrapeCodeStep = createStep({
  id: "scrape_code",
  description: "Scrape the code from a single file",
  inputSchema: z.string(),
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ inputData }) => {
    const filePath = inputData;
    const content = fs.readFileSync(filePath, "utf-8");
    return {
      path: filePath,
      content,
    };
  },
});

// Step 2: Generate documentation for a single file
const generateDocForFileStep = createStep({
  id: "generateDocForFile",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  outputSchema: z.object({
    path: z.string(),
    documentation: z.string(),
  }),
  execute: async ({ inputData }) => {
    const docs = await docGeneratorAgent.generate(
      `Generate documentation for the following code: ${inputData.content}`,
    );
    return {
      path: inputData.path,
      documentation: docs.text.toString(),
    };
  },
});

const generateSummaryWorkflow = createWorkflow({
  id: "generate-summary",
  inputSchema: z.string(),
  outputSchema: z.object({
    path: z.string(),
    documentation: z.string(),
  }),
  steps: [scrapeCodeStep, generateDocForFileStep],
})
  .then(scrapeCodeStep)
  .then(generateDocForFileStep)
  .commit();

export { generateSummaryWorkflow };
```

## Define Readme Generator Workflow

Define a readme generator workflow with 4 steps: one to clone the github repository, one to suspend the workflow and get user input on what all folders to consider while generating a readme, one to generate a summary of all the files inside the folder, and another to collate all the documentation generated for each file into a single readme.

```ts showLineNumbers copy filename="workflows/readme-generator-workflow.ts
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { docGeneratorAgent } from "../agents/docs-generator-agent";
import { generateSummaryWorkflow } from "./file-summary-workflow";
import { z } from "zod";
import simpleGit from "simple-git";
import fs from "fs";
import path from "path";

// Step 1: Clone a GitHub repository locally
const cloneRepositoryStep = createStep({
  id: "clone_repository",
  description: "Clone the repository from the given URL",
  inputSchema: z.object({
    repoUrl: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.object({
      repoUrl: z.string(),
    }),
  }),
  execute: async ({
    inputData,
    mastra,
    getStepResult,
    getInitData,
    runtimeContext,
  }) => {
    const git = simpleGit();
    // Skip cloning if repo already exists
    if (fs.existsSync("./temp")) {
      return {
        success: true,
        message: "Repository already exists",
        data: {
          repoUrl: inputData.repoUrl,
        },
      };
    }
    try {
      // Clone the repository to the ./temp directory
      await git.clone(inputData.repoUrl, "./temp");
      return {
        success: true,
        message: "Repository cloned successfully",
        data: {
          repoUrl: inputData.repoUrl,
        },
      };
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`);
    }
  },
});

// Step 2: Get user input on which folders to analyze
const selectFolderStep = createStep({
  id: "select_folder",
  description: "Select the folder(s) to generate the docs",
  inputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.object({
      repoUrl: z.string(),
    }),
  }),
  outputSchema: z.array(z.string()),
  suspendSchema: z.object({
    folders: z.array(z.string()),
    message: z.string(),
  }),
  resumeSchema: z.object({
    selection: z.array(z.string()),
  }),
  execute: async ({ resumeData, suspend }) => {
    const tempPath = "./temp";
    const folders = fs
      .readdirSync(tempPath)
      .filter((item) => fs.statSync(path.join(tempPath, item)).isDirectory());

    if (!resumeData?.selection) {
      await suspend({
        folders,
        message: "Please select folders to generate documentation for:",
      });
      return [];
    }

    // Gather all file paths from selected folders
    const filePaths: string[] = [];
    // Helper function to recursively read files from directories
    const readFilesRecursively = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          readFilesRecursively(fullPath);
        } else if (stat.isFile()) {
          filePaths.push(fullPath.replace(tempPath + "/", ""));
        }
      }
    };

    for (const folder of resumeData.selection) {
      readFilesRecursively(path.join(tempPath, folder));
    }

    return filePaths;
  },
});

// Step 4: Combine all documentation into a single README
const collateDocumentationStep = createStep({
  id: "collate_documentation",
  inputSchema: z.array(
    z.object({
      path: z.string(),
      documentation: z.string(),
    }),
  ),
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    const readme = await docGeneratorAgent.generate(
      `Generate a README.md file for the following documentation: ${inputData.map((doc) => doc.documentation).join("\n")}`,
    );

    return readme.text.toString();
  },
});

const readmeGeneratorWorkflow = createWorkflow({
  id: "readme-generator",
  inputSchema: z.object({
    repoUrl: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.object({
      repoUrl: z.string(),
    }),
  }),
  steps: [
    cloneRepositoryStep,
    selectFolderStep,
    generateSummaryWorkflow,
    collateDocumentationStep,
  ],
})
  .then(cloneRepositoryStep)
  .then(selectFolderStep)
  .foreach(generateSummaryWorkflow)
  .then(collateDocumentationStep)
  .commit();

export { readmeGeneratorWorkflow };
```

## Register Agent and Workflow instances with Mastra class

Register the agents and workflow with the mastra instance. This is critical for enabling access to the agents within the workflow.

```ts showLineNumbers copy filename="index.ts"
import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { docGeneratorAgent } from "./agents/docs-generator-agent";
import { readmeGeneratorWorkflow } from "./workflows/readme-generator-workflow";
import { generateSummaryWorkflow } from "./workflows/file-summary-workflow";

// Create a new Mastra instance and register components
const mastra = new Mastra({
  agents: {
    docGeneratorAgent,
  },
  workflows: {
    readmeGeneratorWorkflow,
    generateSummaryWorkflow,
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});

export { mastra };
```

## Execute the Readme Generator Workflow

Here, we'll get the reamde generator workflow from the mastra instance, then create a run and execute the created run with the required inputData.

```ts showLineNumbers copy filename="exec.ts"
import { promptUserForFolders } from "./utils";
import { mastra } from "./";

// GitHub repository to generate documentation for
const ghRepoUrl = "https://github.com/mastra-ai/mastra";
const run = await mastra.getWorkflow("readmeGeneratorWorkflow").createRunAsync();

// Start the workflow with the repository URL as input
const res = await run.start({ inputData: { repoUrl: ghRepoUrl } });
const { status, steps } = res;

// Handle suspended workflow (waiting for user input)
if (status === "suspended") {
  // Get the suspended step data
  const suspendedStep = steps["select_folder"];
  let folderList: string[] = [];

  // Extract the folder list from step data
  if (
    suspendedStep.status === "suspended" &&
    "folders" in suspendedStep.payload
  ) {
    folderList = suspendedStep.payload.folders as string[];
  } else if (suspendedStep.status === "success" && suspendedStep.output) {
    folderList = suspendedStep.output;
  }

  if (!folderList.length) {
    console.log("No folders available for selection.");
    process.exit(1);
  }

  // Prompt user to select folders
  const folders = await promptUserForFolders(folderList);

  // Resume the workflow with user selections
  const resumedResult = await run.resume({
    resumeData: { selection: folders },
    step: "select_folder",
  });

  // Print resumed result
  if (resumedResult.status === "success") {
    console.log(resumedResult.result);
  } else {
    console.log(resumedResult);
  }
  process.exit(1);
}

// Handle completed workflow
if (res.status === "success") {
  console.log(res.result ?? res);
} else {
  console.log(res);
}
```

## Workflows (Legacy)

The following links provide example documentation for legacy workflows:

- [Creating a Simple Workflow (Legacy)](/examples/workflows_legacy/creating-a-workflow)
- [Data Mapping with Workflow Variables (Legacy)](/examples/workflows_legacy/workflow-variables)


---
title: "Example: Calling an Agent from a Workflow | Mastra Docs"
description: Example of using Mastra to call an AI agent from within a workflow step.
---

# Calling an Agent From a Workflow
[EN] Source: https://mastra.ai/en/examples/workflows/calling-agent

This example demonstrates how to create a workflow that calls an AI agent to suggest activities for the provided weather conditions, and execute it within a workflow step.

## Setup

```sh copy
npm install @ai-sdk/openai @mastra/core
```

## Define Planning Agent

Define a planning agent which leverages an LLM call to plan activities given a location and corresponding weather conditions.

```ts showLineNumbers copy filename="agents/planning-agent.ts"
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const llm = openai("gpt-4o");

// Create a new agent for activity planning
const planningAgent = new Agent({
  name: "planningAgent",
  model: llm,
  instructions: `
        You are a local activities and travel expert who excels at weather-based planning. Analyze the weather data and provide practical activity recommendations.

        📅 [Day, Month Date, Year]
        ═══════════════════════════

        🌡️ WEATHER SUMMARY
        • Conditions: [brief description]
        • Temperature: [X°C/Y°F to A°C/B°F]
        • Precipitation: [X% chance]

        🌅 MORNING ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🌞 AFTERNOON ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🏠 INDOOR ALTERNATIVES
        • [Activity Name] - [Brief description including specific venue]
          Ideal for: [weather condition that would trigger this alternative]

        ⚠️ SPECIAL CONSIDERATIONS
        • [Any relevant weather warnings, UV index, wind conditions, etc.]

        Guidelines:
        - Suggest 2-3 time-specific outdoor activities per day
        - Include 1-2 indoor backup options
        - For precipitation >50%, lead with indoor activities
        - All activities must be specific to the location
        - Include specific venues, trails, or locations
        - Consider activity intensity based on temperature
        - Keep descriptions concise but informative

        Maintain this exact formatting for consistency, using the emoji and section headers as shown.
      `,
});

export { planningAgent };
```

## Define Activity Planning Workflow

Define the activity planning workflow with 2 steps: one to fetch the weather via a network call, and another to plan activities using the planning agent.

```ts showLineNumbers copy filename="workflows/agent-workflow.ts"
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Helper function to convert numeric weather codes to human-readable descriptions
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
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    95: "Thunderstorm",
  };
  return conditions[code] || "Unknown";
}

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
});
```

### Step 1: Create a step to fetch weather data for a given city

```ts showLineNumbers copy filename="workflows/agent-workflow.ts"
const fetchWeather = createStep({
  id: "fetch-weather",
  description: "Fetches weather forecast for a given city",
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Trigger data not found");
    }

    // First API call: Convert city name to latitude and longitude
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${inputData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    // Second API call: Get weather data using coordinates
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        precipitation: number;
        weathercode: number;
      };
      hourly: {
        precipitation_probability: number[];
        temperature_2m: number[];
      };
    };

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      location: name,
      precipitationChance: data.hourly.precipitation_probability.reduce(
        (acc, curr) => Math.max(acc, curr),
        0,
      ),
    };

    return forecast;
  },
});
```

### Step 2: Create a step to generate activity recommendations using the agent

```ts showLineNumbers copy filename="workflows/agent-workflow.ts"
const planActivities = createStep({
  id: "plan-activities",
  description: "Suggests activities based on weather conditions",
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData;

    if (!forecast) {
      throw new Error("Forecast data not found");
    }

    const prompt = `Based on the following weather forecast for ${forecast.location}, suggest appropriate activities:
      ${JSON.stringify(forecast, null, 2)}
      `;

    const agent = mastra?.getAgent("planningAgent");
    if (!agent) {
      throw new Error("Planning agent not found");
    }

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let activitiesText = "";
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});

const activityPlanningWorkflow = createWorkflow({
  steps: [fetchWeather, planActivities],
  id: "activity-planning-step1-single-day",
  inputSchema: z.object({
    city: z.string().describe("The city to get the weather for"),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather)
  .then(planActivities);

activityPlanningWorkflow.commit();

export { activityPlanningWorkflow };
```

## Register Agent and Workflow instances with Mastra class

Register the planning agent and activity planning workflow with the mastra instance.
This is critical for enabling access to the planning agent within the activity planning workflow.

```ts showLineNumbers copy filename="index.ts"
import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { activityPlanningWorkflow } from "./workflows/agent-workflow";
import { planningAgent } from "./agents/planning-agent";

// Create a new Mastra instance and register components
const mastra = new Mastra({
  workflows: {
    activityPlanningWorkflow,
  },
  agents: {
    planningAgent,
  },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
});

export { mastra };
```

## Execute the activity planning workflow

Here, we'll get the activity planning workflow from the mastra instance, then create a run and execute the created run with the required inputData.

```ts showLineNumbers copy filename="exec.ts"
import { mastra } from "./";

const workflow = mastra.getWorkflow("activityPlanningWorkflow");
const run = await workflow.createRunAsync();

// Start the workflow with New York as the city input
const result = await run.start({ inputData: { city: "New York" } });
console.dir(result, { depth: null });
```

## Workflows (Legacy)

The following links provide example documentation for legacy workflows:

- [Calling an Agent From a Workflow (Legacy)](/examples/workflows_legacy/calling-agent)



---
title: "Example: Workflow as Tools | Agents | Mastra Docs"
description: Example of creating Agents in Mastra, demonstrating how to use workflows as tools. It shows how to suspend and resume workflows from an agent.
---

import { GithubLink } from "@/components/github-link";

# Workflow as Tools
[EN] Source: https://mastra.ai/en/examples/agents/workflow-as-tools

When building AI applications, you often need to coordinate multiple steps that depend on each other's outputs. This example shows how to create an AI workflow that fetches weather data from a workflow. It also demonstrates how to handle suspend and resume of workflows from an agent.

### Workflow Definition

```ts showLineNumbers copy
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { createTool } from '@mastra/core/tools';
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
});

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    95: 'Thunderstorm',
  };
  return conditions[code] || 'Unknown';
}

const fetchWeatherWithSuspend = createStep({
  id: 'fetch-weather',
  description: 'Fetches weather forecast for a given city',
  inputSchema: z.object({}),
  resumeSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ resumeData, suspend }) => {
    if (!resumeData) {
      suspend({
        message: 'Please enter the city to get the weather for',
      });

      return {};
    }

    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(resumeData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${resumeData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        precipitation: number;
        weathercode: number;
      };
      hourly: {
        precipitation_probability: number[];
        temperature_2m: number[];
      };
    };

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      precipitationChance: data.hourly.precipitation_probability.reduce((acc, curr) => Math.max(acc, curr), 0),
      location: resumeData.city,
    };

    return forecast;
  },
});

const weatherWorkflowWithSuspend = createWorkflow({
  id: 'weather-workflow-with-suspend',
  inputSchema: z.object({}),
  outputSchema: forecastSchema,
})
  .then(fetchWeatherWithSuspend)
  .commit();
```

### Tool Definitions

```ts
export const startWeatherTool = createTool({
  id: 'start-weather-tool',
  description: 'Start the weather tool',
  inputSchema: z.object({}),
  outputSchema: z.object({
    runId: z.string(),
  }),
  execute: async ({ context }) => {
    const workflow = mastra.getWorkflow('weatherWorkflowWithSuspend');
    const run = await workflow.createRunAsync();
    await run.start({
      inputData: {},
    });

    return {
      runId: run.runId,
    };
  },
});

export const resumeWeatherTool = createTool({
  id: 'resume-weather-tool',
  description: 'Resume the weather tool',
  inputSchema: z.object({
    runId: z.string(),
    city: z.string().describe('City name'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ context }) => {
    const workflow = mastra.getWorkflow('weatherWorkflowWithSuspend');
    const run = await workflow.createRunAsync({
      runId: context.runId,
    });
    const result = await run.resume({
      step: 'fetch-weather',
      resumeData: {
        city: context.city,
      },
    });
    return result.result;
  },
});
```

### Agent Definition

```ts
export const weatherAgentWithWorkflow = new Agent({
  name: 'Weather Agent with Workflow',
  instructions: `You are a helpful weather assistant that provides accurate weather information.

Your primary function is to help users get weather details for specific locations. When responding:
- Always ask for a location if none is provided
- If the location name isn’t in English, please translate it
- If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
- Include relevant details like humidity, wind conditions, and precipitation
- Keep responses concise but informative

Use the startWeatherTool to start the weather workflow. This will start and then suspend the workflow and return a runId.
Use the resumeWeatherTool to resume the weather workflow. This takes the runId returned from the startWeatherTool and the city entered by the user. It will resume the workflow and return the result.
The result will be the weather forecast for the city.`,
  model: openai('gpt-4o'),
  tools: { startWeatherTool, resumeWeatherTool },
});
```

### Agent Execution
```ts
const mastra = new Mastra({
  agents: { weatherAgentWithWorkflow },
  workflows: { weatherWorkflowWithSuspend },
});

const agent = mastra.getAgent('weatherAgentWithWorkflow');
const result = await agent.generate([
  {
    role: 'user',
    content: 'London',
  },
]);

console.log(result);
```

<br/>

<GithubLink
  link={
    "https://github.com/mastra-ai/mastra/blob/main/examples/basics/agents/workflow-as-tools"
  }
/>


---
title: Deployment examples
---

# Examples
[EN] Source: https://mastra.ai/en/examples

The Examples section is a short list of example projects demonstrating basic AI engineering with Mastra, including text generation, structured output, streaming responses, retrieval‐augmented generation (RAG), and voice.

<CardItems titles={["Agent", "Workflow", "legacyWorkflow", "Memory", "RAG", "Evals", "Voice"]} items={
  {
    Agent: [
      {
        title: "Agent with System Prompt",
        href: "/examples/agents/system-prompt",
      },
      {
        title: "Workflow as Tools",
        href: "/examples/agents/workflow-as-tools",
      },
      {
        title: "Using a Tool",
        href: "/examples/agents/using-a-tool",
      },
      {
        title: "Hierarchical Multi-Agent System",
        href: "/examples/agents/hierarchical-multi-agent",
      },
      {
        title: "Multi-Agent Workflow",
        href: "/examples/agents/multi-agent-workflow",
      },
      {
        title: "Bird Checker",
        href: "/examples/agents/bird-checker",
      },
      {
        title: "Dynamic Agents",
        href: "/examples/agents/dynamic-agents"
      }
    ],
    Workflow: [
      {
        title: "Conditional Branching",
        href: "/examples/workflows/conditional-branching",
      },
      {
        title: "Parallel Steps",
        href: "/examples/workflows/parallel-steps",
      },
      {
        title: "Calling an Agent",
        href: "/examples/workflows/calling-agent",
      },
      {
        title: "Tool & Agent as a Step",
        href: "/examples/workflows/agent-and-tool-interop",
      },
      {
        title: "Human in the loop",
        href: "/examples/workflows/human-in-the-loop",
      },
      {
        title: "Control Flow",
        href: "/examples/workflows/control-flow",
      },
      {
        title: "Array as Input",
        href: "/examples/workflows/array-as-input",
      }
    ],
    legacyWorkflow: [
      {
        title: "Creating a Workflow",
        href: "/examples/workflows_legacy/creating-a-workflow",
      },
      {
        title: "Using a Tool as a Step",
        href: "/examples/workflows_legacy/using-a-tool-as-a-step",
      },
      { title: "Parallel Steps", href: "/examples/workflows_legacy/parallel-steps" },
      {
        title: "Sequential Steps",
        href: "/examples/workflows_legacy/sequential-steps",
      },
      { title: "Branching Paths", href: "/examples/workflows_legacy/branching-paths" },
      {
        title: "Cyclical Dependencies",
        href: "/examples/workflows_legacy/cyclical-dependencies",
      },
      {
        title: "Suspend and Resume",
        href: "/examples/workflows_legacy/suspend-and-resume",
      },
      { title: "Calling an Agent", href: "/examples/workflows_legacy/calling-agent" },
    ],
    Memory:[
      {
        title: "Long-term Memory with LibSQL",
        href: "/examples/memory/memory-with-libsql",
      },
      {
        title: "Long-term Memory with Postgres",
        href: "/examples/memory/memory-with-pg",
      },
      {
        title: "Long-term Memory with Upstash",
        href: "/examples/memory/memory-with-upstash",
      },
      {
        title: "Long-term Memory with Mem0",
        href: "/examples/memory/memory-with-mem0"
      },
      {
        title: "Streaming Working Memory (quickstart)",
        href: "/examples/memory/streaming-working-memory",
      },
      {
        title: "Streaming Working Memory (advanced)",
        href: "/examples/memory/streaming-working-memory-advanced",
      },
    ],
    RAG: [
      { title: "Chunk Text", href: "/examples/rag/chunking/chunk-text" },
      { title: "Chunk Markdown", href: "/examples/rag/chunking/chunk-markdown" },
      { title: "Chunk HTML", href: "/examples/rag/chunking/chunk-html" },
      { title: "Chunk JSON", href: "/examples/rag/chunking/chunk-json" },
      { title: "Embed Text Chunk", href: "/examples/rag/embedding/embed-text-chunk" },
      { title: "Embed Chunk Array", href: "/examples/rag/embedding/embed-chunk-array" },
      { title: "Adjust Chunk Size", href: "/examples/rag/chunking/adjust-chunk-size" },
      {
        title: "Adjust Chunk Delimiters",
        href: "/examples/rag/chunking/adjust-chunk-delimiters",
      },
      {
        title: "Metadata Extraction",
        href: "/examples/rag/embedding/metadata-extraction",
      },
      {
        title: "Hybrid Vector Search",
        href: "/examples/rag/query/hybrid-vector-search",
      },
      {
        title: "Embed Text with Cohere",
        href: "/examples/rag/embedding/embed-text-with-cohere",
      },
      {
        title: "Upsert Embeddings",
        href: "/examples/rag/upsert/upsert-embeddings",
      },
      { title: "Retrieve Results", href: "/examples/rag/query/retrieve-results" },
      { title: "Using the Vector Query Tool", href: "/examples/rag/usage/basic-rag" },
      {
        title: "Optimizing Information Density",
        href: "/examples/rag/usage/cleanup-rag",
      },
      { title: "Metadata Filtering", href: "/examples/rag/usage/filter-rag" },
      {
        title: "Re-ranking Results",
        href: "/examples/rag/rerank/rerank",
      },
      {
        title: "Re-ranking Results with Tools",
        href: "/examples/rag/rerank/rerank-rag",
      },
      { title: "Chain of Thought Prompting", href: "/examples/rag/usage/cot-rag" },
      {
        title: "Structured Reasoning with Workflows",
        href: "/examples/rag/usage/cot-workflow-rag",
      },
      { title: "Graph RAG", href: "/examples/rag/usage/graph-rag" },
    ],
    Evals: [
      {
        title: "Answer Relevancy",
        href: "/examples/evals/answer-relevancy",
      },
      {
        title: "Bias",
        href: "/examples/evals/bias",
      },
      {
        title: "Completeness",
        href: "/examples/evals/completeness",
      },
      {
        title: "Content Similarity",
        href: "/examples/evals/content-similarity",
      },
      {
        title: "Context Position",
        href: "/examples/evals/context-position",
      },
      {
        title: "Context Precision",
        href: "/examples/evals/context-precision",
      },
      {
        title: "Context Relevancy",
        href: "/examples/evals/context-relevancy",
      },
      {
        title: "Contextual Recall",
        href: "/examples/evals/contextual-recall",
      },
      {
        title: "Custom Eval with LLM as a Judge",
        href: "/examples/evals/custom-eval",
      },
      {
        title: "Faithfulness",
        href: "/examples/evals/faithfulness",
      },
      {
        title: "Hallucination",
        href: "/examples/evals/hallucination",
      },
      {
        title: "Keyword Coverage",
        href: "/examples/evals/keyword-coverage",
      },
      {
        title: "Prompt Alignment",
        href: "/examples/evals/prompt-alignment",
      },
      {
        title: "Summarization",
        href: "/examples/evals/summarization",
      },
      {
        title: "Textual Difference",
        href: "/examples/evals/textual-difference",
      },
      {
        title: "Tone Consistency", 
        href: "/examples/evals/tone-consistency",
      },
      {
        title: "Toxicity",
        href: "/examples/evals/toxicity",
      },
      {
        title: "Word Inclusion",
        href: "/examples/evals/word-inclusion",
      },
    ],
    Voice: [
    {
      title: "Text to Speech",
      href: "/examples/voice/text-to-speech",
    },
    {
      title: "Speech to Text",
      href: "/examples/voice/speech-to-text",
    },
    {
      title: "Turn Taking",
      href: "/examples/voice/turn-taking",
    },
    {
      title: "Speech to Speech",
      href: "/examples/voice/speech-to-speech",
    },
    ],
}}>

</CardItems>



---
title: "Example: Conditional Branching | Workflows | Mastra Docs"
description: Example of using Mastra to create conditional branches in workflows using the `branch` statement .
---

# Workflow with Conditional Branching
[EN] Source: https://mastra.ai/en/examples/workflows/conditional-branching

Workflows often need to follow different paths based on some condition.
This example demonstrates how to use the `branch` construct to create conditional flows within your workflows.

## Setup

```sh copy
npm install @ai-sdk/openai @mastra/core
```

## Define Planning Agent

Define a planning agent which leverages an LLM call to plan activities given a location and corresponding weather conditions.

```ts showLineNumbers copy filename="agents/planning-agent.ts"
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const llm = openai("gpt-4o");

// Define the planning agent that generates activity recommendations
// based on weather conditions and location
const planningAgent = new Agent({
  name: "planningAgent",
  model: llm,
  instructions: `
        You are a local activities and travel expert who excels at weather-based planning. Analyze the weather data and provide practical activity recommendations.

        📅 [Day, Month Date, Year]
        ═══════════════════════════

        🌡️ WEATHER SUMMARY
        • Conditions: [brief description]
        • Temperature: [X°C/Y°F to A°C/B°F]
        • Precipitation: [X% chance]

        🌅 MORNING ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🌞 AFTERNOON ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🏠 INDOOR ALTERNATIVES
        • [Activity Name] - [Brief description including specific venue]
          Ideal for: [weather condition that would trigger this alternative]

        ⚠️ SPECIAL CONSIDERATIONS
        • [Any relevant weather warnings, UV index, wind conditions, etc.]

        Guidelines:
        - Suggest 2-3 time-specific outdoor activities per day
        - Include 1-2 indoor backup options
        - For precipitation >50%, lead with indoor activities
        - All activities must be specific to the location
        - Include specific venues, trails, or locations
        - Consider activity intensity based on temperature
        - Keep descriptions concise but informative

        Maintain this exact formatting for consistency, using the emoji and section headers as shown.
      `,
});

export { planningAgent };
```

## Define Activity Planning Workflow

Define the planning workflow with 3 steps: one to fetch the weather via a network call, one to plan activities, and another to plan only indoor activities.
Both using the planning agent.

```ts showLineNumbers copy filename="workflows/conditional-workflow.ts"
import { z } from "zod";
import { createWorkflow, createStep } from "@mastra/core/workflows";

// Helper function to convert weather codes to human-readable conditions
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
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    95: "Thunderstorm",
  };
  return conditions[code] || "Unknown";
}

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
});
```

### Step to fetch weather data for a given city

Makes API calls to get current weather conditions and forecast

```ts showLineNumbers copy filename="workflows/conditional-workflow.ts"
const fetchWeather = createStep({
  id: "fetch-weather",
  description: "Fetches weather forecast for a given city",
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Trigger data not found");
    }

    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${inputData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        precipitation: number;
        weathercode: number;
      };
      hourly: {
        precipitation_probability: number[];
        temperature_2m: number[];
      };
    };

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      location: name,
      precipitationChance: data.hourly.precipitation_probability.reduce(
        (acc, curr) => Math.max(acc, curr),
        0,
      ),
    };

    return forecast;
  },
});
```

### Step to plan activities based on weather conditions

Uses the planning agent to generate activity recommendations

```ts showLineNumbers copy filename="workflows/conditional-workflow.ts"
const planActivities = createStep({
  id: "plan-activities",
  description: "Suggests activities based on weather conditions",
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData;

    if (!forecast) {
      throw new Error("Forecast data not found");
    }

    const prompt = `Based on the following weather forecast for ${forecast.location}, suggest appropriate activities:
      ${JSON.stringify(forecast, null, 2)}
      `;

    const agent = mastra?.getAgent("planningAgent");
    if (!agent) {
      throw new Error("Planning agent not found");
    }

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let activitiesText = "";

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});
```

### Step to plan indoor activities only

Used when precipitation chance is high

```ts showLineNumbers copy filename="workflows/conditional-workflow.ts"
const planIndoorActivities = createStep({
  id: "plan-indoor-activities",
  description: "Suggests indoor activities based on weather conditions",
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData;

    if (!forecast) {
      throw new Error("Forecast data not found");
    }

    const prompt = `In case it rains, plan indoor activities for ${forecast.location} on ${forecast.date}`;

    const agent = mastra?.getAgent("planningAgent");
    if (!agent) {
      throw new Error("Planning agent not found");
    }

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let activitiesText = "";

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});
```

### Main workflow

```ts showLineNumbers copy filename="workflows/conditional-workflow.ts"
const activityPlanningWorkflow = createWorkflow({
  id: "activity-planning-workflow-step2-if-else",
  inputSchema: z.object({
    city: z.string().describe("The city to get the weather for"),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather)
  .branch([
    // Branch for high precipitation (indoor activities)
    [
      async ({ inputData }) => {
        return inputData?.precipitationChance > 50;
      },
      planIndoorActivities,
    ],
    // Branch for low precipitation (outdoor activities)
    [
      async ({ inputData }) => {
        return inputData?.precipitationChance <= 50;
      },
      planActivities,
    ],
  ]);

activityPlanningWorkflow.commit();

export { activityPlanningWorkflow };
```

## Register Agent and Workflow instances with Mastra class

Register the agents and workflow with the mastra instance.
This is critical for enabling access to the agents within the workflow.

```ts showLineNumbers copy filename="index.ts"
import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { activityPlanningWorkflow } from "./workflows/conditional-workflow";
import { planningAgent } from "./agents/planning-agent";

// Initialize Mastra with the activity planning workflow
// This enables the workflow to be executed and access the planning agent
const mastra = new Mastra({
  workflows: {
    activityPlanningWorkflow,
  },
  agents: {
    planningAgent,
  },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
});

export { mastra };
```

## Execute the activity planning workflow

Here, we'll get the activity planning workflow from the mastra instance, then create a run and execute the created run with the required inputData.

```ts showLineNumbers copy filename="exec.ts"
import { mastra } from "./";

const workflow = mastra.getWorkflow("activityPlanningWorkflow");
const run = await workflow.createRunAsync();

// Start the workflow with a city
// This will fetch weather and plan activities based on conditions
const result = await run.start({ inputData: { city: "New York" } });
console.dir(result, { depth: null });
```

## Workflows (Legacy)

The following links provide example documentation for legacy workflows:

- [Branching Paths](/examples/workflows_legacy/branching-paths)
- [Workflow (Legacy) with Conditional Branching (experimental)](/examples/workflows_legacy/conditional-branching)



---
title: "Example: Control Flow | Workflows | Mastra Docs"
description: Example of using Mastra to create workflows with loops based on provided conditions.
---

# Looping step execution
[EN] Source: https://mastra.ai/en/examples/workflows/control-flow

## Setup

```sh copy
npm install @ai-sdk/openai @mastra/core
```

## Define Looping workflow

Defines a workflow which calls the executes a nested workflow until the provided condition is met.

```ts showLineNumbers copy filename="looping-workflow.ts"
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Step that increments the input value by 1
const incrementStep = createStep({
  id: "increment",
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value + 1 };
  },
});

// Step that logs the current value (side effect)
const sideEffectStep = createStep({
  id: "side-effect",
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log("log", inputData.value);
    return { value: inputData.value };
  },
});

// Final step that returns the final value
const finalStep = createStep({
  id: "final",
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value };
  },
});

// Create a workflow that:
// 1. Increments a number until it reaches 10
// 2. Logs each increment (side effect)
// 3. Returns the final value
const workflow = createWorkflow({
  id: "increment-workflow",
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .dountil(
    // Nested workflow that performs the increment and logging
    createWorkflow({
      id: "increment-workflow",
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      steps: [incrementStep, sideEffectStep],
    })
      .then(incrementStep)
      .then(sideEffectStep)
      .commit(),
    // Condition to check if we should stop the loop
    async ({ inputData }) => inputData.value >= 10,
  )
  .then(finalStep);

workflow.commit();

export { workflow as incrementWorkflow };
```

## Register Workflow instance with Mastra class

Register the workflow with the mastra instance.

```ts showLineNumbers copy filename="index.ts"
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { incrementWorkflow } from "./workflows";

// Initialize Mastra with the increment workflow
// This enables the workflow to be executed
const mastra = new Mastra({
  workflows: {
    incrementWorkflow,
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});

export { mastra };
```

## Execute the workflow

Here, we'll get the increment workflow from the mastra instance, then create a run and execute the created run with the required inputData.

```ts showLineNumbers copy filename="exec.ts"
import { mastra } from "./";

const workflow = mastra.getWorkflow("incrementWorkflow");
const run = await workflow.createRunAsync();

// Start the workflow with initial value 0
// This will increment until reaching 10
const result = await run.start({ inputData: { value: 0 } });
console.dir(result, { depth: null });
```

## Workflows (Legacy)

The following links provide example documentation for legacy workflows:

- [Workflow (Legacy) with Sequential Steps](/examples/workflows_legacy/sequential-steps)
- [Parallel Execution with Steps](/examples/workflows_legacy/parallel-steps)
- [Branching Paths](/examples/workflows_legacy/branching-paths)
- [Workflow (Legacy) with Conditional Branching (experimental)](/examples/workflows_legacy/conditional-branching)
- [Data Mapping with Workflow Variables (Legacy)](/examples/workflows_legacy/workflow-variables)


---
title: "Example: Human in the Loop | Workflows | Mastra Docs"
description: Example of using Mastra to create workflows with human intervention points.
---

# Human in the Loop Workflow
[EN] Source: https://mastra.ai/en/examples/workflows/human-in-the-loop

Human-in-the-loop workflows allow you to pause execution at specific points to collect user input, make decisions, or perform actions that require human judgment.
This example demonstrates how to create a workflow with human intervention points.

## Setup

```sh copy
npm install @ai-sdk/openai @mastra/core @inquirer/prompts
```

## Define Agents

Define the travel agents.

```ts showLineNumbers copy filename="agents/travel-agents.ts"
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const llm = openai("gpt-4o");

// Agent that generates multiple holiday options
// Returns a JSON array of locations and descriptions
export const summaryTravelAgent = new Agent({
  name: "summaryTravelAgent",
  model: llm,
  instructions: `
  You are a travel agent who is given a user prompt about what kind of holiday they want to go on.
  You then generate 3 different options for the holiday. Return the suggestions as a JSON array {"location": "string", "description": "string"}[]. Don't format as markdown.
  Make the options as different as possible from each other.
  Also make the plan very short and summarized.
  `,
});

// Agent that creates detailed travel plans
// Takes the selected option and generates a comprehensive itinerary
export const travelAgent = new Agent({
  name: "travelAgent",
  model: llm,
  instructions: `
  You are a travel agent who is given a user prompt about what kind of holiday they want to go on. A summary of the plan is provided as well as the location.
  You then generate a detailed travel plan for the holiday.
  `,
});
```

## Define Suspendable workflow

Defines a workflow which includes a suspending step: `humanInputStep`.

```ts showLineNumbers copy filename="workflows/human-in-the-loop-workflow.ts"
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Step that generates multiple holiday options based on user's vacation description
// Uses the summaryTravelAgent to create diverse travel suggestions
const generateSuggestionsStep = createStep({
  id: "generate-suggestions",
  inputSchema: z.object({
    vacationDescription: z.string().describe("The description of the vacation"),
  }),
  outputSchema: z.object({
    suggestions: z.array(z.string()),
    vacationDescription: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!mastra) {
      throw new Error("Mastra is not initialized");
    }

    const { vacationDescription } = inputData;
    const result = await mastra.getAgent("summaryTravelAgent").generate([
      {
        role: "user",
        content: vacationDescription,
      },
    ]);
    console.log(result.text);
    return { suggestions: JSON.parse(result.text), vacationDescription };
  },
});

// Step that pauses the workflow to get user input
// Allows the user to select their preferred holiday option from the suggestions
// Uses suspend/resume mechanism to handle the interaction
const humanInputStep = createStep({
  id: "human-input",
  inputSchema: z.object({
    suggestions: z.array(z.string()),
    vacationDescription: z.string(),
  }),
  outputSchema: z.object({
    selection: z.string().describe("The selection of the user"),
    vacationDescription: z.string(),
  }),
  resumeSchema: z.object({
    selection: z.string().describe("The selection of the user"),
  }),
  suspendSchema: z.object({
    suggestions: z.array(z.string()),
  }),
  execute: async ({ inputData, resumeData, suspend, getInitData }) => {
    if (!resumeData?.selection) {
      return suspend({ suggestions: inputData?.suggestions });
    }

    return {
      selection: resumeData?.selection,
      vacationDescription: inputData?.vacationDescription,
    };
  },
});

// Step that creates a detailed travel plan based on the user's selection
// Uses the travelAgent to generate comprehensive holiday details
const travelPlannerStep = createStep({
  id: "travel-planner",
  inputSchema: z.object({
    selection: z.string().describe("The selection of the user"),
    vacationDescription: z.string(),
  }),
  outputSchema: z.object({
    travelPlan: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const travelAgent = mastra?.getAgent("travelAgent");
    if (!travelAgent) {
      throw new Error("Travel agent is not initialized");
    }

    const { selection, vacationDescription } = inputData;
    const result = await travelAgent.generate([
      { role: "assistant", content: vacationDescription },
      { role: "user", content: selection || "" },
    ]);
    console.log(result.text);
    return { travelPlan: result.text };
  },
});

// Main workflow that orchestrates the holiday planning process:
// 1. Generates multiple options
// 2. Gets user input
// 3. Creates detailed plan
const travelAgentWorkflow = createWorkflow({
  id: "travel-agent-workflow",
  inputSchema: z.object({
    vacationDescription: z.string().describe("The description of the vacation"),
  }),
  outputSchema: z.object({
    travelPlan: z.string(),
  }),
})
  .then(generateSuggestionsStep)
  .then(humanInputStep)
  .then(travelPlannerStep);

travelAgentWorkflow.commit();

export { travelAgentWorkflow, humanInputStep };
```

## Register Agent and Workflow instances with Mastra class

Register the agents and the weather workflow with the mastra instance.
This is critical for enabling access to the agents within the workflow.

```ts showLineNumbers copy filename="index.ts"
import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { travelAgentWorkflow } from "./workflows/human-in-the-loop-workflow";
import { summaryTravelAgent, travelAgent } from "./agents/travel-agent";

// Initialize Mastra instance with:
// - The travel planning workflow
// - Both travel agents (summary and detailed planning)
// - Logging configuration
const mastra = new Mastra({
  workflows: {
    travelAgentWorkflow,
  },
  agents: {
    travelAgent,
    summaryTravelAgent,
  },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
});

export { mastra };
```

## Execute the suspendable weather workflow

Here, we'll get the weather workflow from the mastra instance, then create a run and execute the created run with the required inputData.
In addition to this, we'll resume the `humanInputStep` after collecting user input with the readline package.

```ts showLineNumbers copy filename="exec.ts"
import { mastra } from "./";
import { select } from "@inquirer/prompts";
import { humanInputStep } from "./workflows/human-in-the-loop-workflow";

const workflow = mastra.getWorkflow("travelAgentWorkflow");
const run = await workflow.createRunAsync();

// Start the workflow with initial vacation description
const result = await run.start({
  inputData: { vacationDescription: "I want to go to the beach" },
});

console.log("result", result);

const suggStep = result?.steps?.["generate-suggestions"];

// If suggestions were generated successfully, proceed with user interaction
if (suggStep.status === "success") {
  const suggestions = suggStep.output?.suggestions;

  // Present options to user and get their selection
  const userInput = await select<string>({
    message: "Choose your holiday destination",
    choices: suggestions.map(
      ({ location, description }: { location: string; description: string }) =>
        `- ${location}: ${description}`,
    ),
  });

  console.log("Selected:", userInput);

  // Prepare to resume the workflow with user's selection
  console.log("resuming from", result, "with", {
    inputData: {
      selection: userInput,
      vacationDescription: "I want to go to the beach",
      suggestions: suggStep?.output?.suggestions,
    },
    step: humanInputStep,
  });

  const result2 = await run.resume({
    resumeData: {
      selection: userInput,
    },
    step: humanInputStep,
  });

  console.dir(result2, { depth: null });
}
```

Human-in-the-loop workflows are powerful for building systems that blend automation with human judgment, such as:

- Content moderation systems
- Approval workflows
- Supervised AI systems
- Customer service automation with escalation

## Workflows (Legacy)

The following links provide example documentation for legacy workflows:

- [Human in the Loop Workflow (Legacy)](/examples/workflows_legacy/human-in-the-loop)



---
title: "Example: Parallel Execution | Workflows | Mastra Docs"
description: Example of using Mastra to execute multiple independent tasks in parallel within a workflow.
---

# Parallel Execution with Steps
[EN] Source: https://mastra.ai/en/examples/workflows/parallel-steps

When building AI applications, you often need to process multiple independent tasks simultaneously to improve efficiency.
We make this functionality a core part of workflows through the `.parallel` method.

## Setup

```sh copy
npm install @ai-sdk/openai @mastra/core
```

## Define Planning Agent

Define a planning agent which leverages an LLM call to plan activities given a location and corresponding weather conditions.

```ts showLineNumbers copy filename="agents/planning-agent.ts"
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const llm = openai("gpt-4o");

// Define the planning agent with specific instructions for formatting
// and structuring weather-based activity recommendations
const planningAgent = new Agent({
  name: "planningAgent",
  model: llm,
  instructions: `
        You are a local activities and travel expert who excels at weather-based planning. Analyze the weather data and provide practical activity recommendations.

        📅 [Day, Month Date, Year]
        ═══════════════════════════

        🌡️ WEATHER SUMMARY
        • Conditions: [brief description]
        • Temperature: [X°C/Y°F to A°C/B°F]
        • Precipitation: [X% chance]

        🌅 MORNING ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🌞 AFTERNOON ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🏠 INDOOR ALTERNATIVES
        • [Activity Name] - [Brief description including specific venue]
          Ideal for: [weather condition that would trigger this alternative]

        ⚠️ SPECIAL CONSIDERATIONS
        • [Any relevant weather warnings, UV index, wind conditions, etc.]

        Guidelines:
        - Suggest 2-3 time-specific outdoor activities per day
        - Include 1-2 indoor backup options
        - For precipitation >50%, lead with indoor activities
        - All activities must be specific to the location
        - Include specific venues, trails, or locations
        - Consider activity intensity based on temperature
        - Keep descriptions concise but informative

        Maintain this exact formatting for consistency, using the emoji and section headers as shown.
      `,
});

export { planningAgent };
```

## Define Synthesize Agent

Define a synthesize agent which takes planned indoor and outdoor activities and provides a full report on the day.

```ts showLineNumbers copy filename="agents/synthesize-agent.ts"
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const llm = openai("gpt-4o");

// Define the synthesize agent that combines indoor and outdoor activity plans
// into a comprehensive report, considering weather conditions and alternatives
const synthesizeAgent = new Agent({
  name: "synthesizeAgent",
  model: llm,
  instructions: `
  You are given two different blocks of text, one about indoor activities and one about outdoor activities.
  Make this into a full report about the day and the possibilities depending on whether it rains or not.
  `,
});

export { synthesizeAgent };
```

## Define Parallel Workflow

Here, we'll define a workflow which orchestrates a parallel -> sequential flow between the planning steps and the synthesize step.

```ts showLineNumbers copy filename="workflows/parallel-workflow.ts"
import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
});

// Step to fetch weather data for a given city
// Makes API calls to get current weather conditions and forecast
const fetchWeather = createStep({
  id: "fetch-weather",
  description: "Fetches weather forecast for a given city",
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Trigger data not found");
    }

    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${inputData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        precipitation: number;
        weathercode: number;
      };
      hourly: {
        precipitation_probability: number[];
        temperature_2m: number[];
      };
    };

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      location: name,
      precipitationChance: data.hourly.precipitation_probability.reduce(
        (acc, curr) => Math.max(acc, curr),
        0,
      ),
    };

    return forecast;
  },
});
```

### Step to plan outdoor activities based on weather conditions

Uses the planning agent to generate activity recommendations

```ts showLineNumbers copy filename="workflows/parallel-workflow.ts"
const planActivities = createStep({
  id: "plan-activities",
  description: "Suggests activities based on weather conditions",
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData;

    if (!forecast) {
      throw new Error("Forecast data not found");
    }

    const prompt = `Based on the following weather forecast for ${forecast.location}, suggest appropriate activities:
      ${JSON.stringify(forecast, null, 2)}
      `;

    const agent = mastra?.getAgent("planningAgent");
    if (!agent) {
      throw new Error("Planning agent not found");
    }

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let activitiesText = "";

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }
    return {
      activities: activitiesText,
    };
  },
});
```

### Helper function to convert weather codes to human-readable conditions

Maps numeric codes from the weather API to descriptive strings

```ts showLineNumbers copy filename="workflows/parallel-workflow.ts"
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
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    95: "Thunderstorm",
  };
  return conditions[code] || "Unknown";
}

// Step to plan indoor activities as backup options
// Generates alternative indoor activities in case of bad weather
const planIndoorActivities = createStep({
  id: "plan-indoor-activities",
  description: "Suggests indoor activities based on weather conditions",
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData;

    if (!forecast) {
      throw new Error("Forecast data not found");
    }

    const prompt = `In case it rains, plan indoor activities for ${forecast.location} on ${forecast.date}`;

    const agent = mastra?.getAgent("planningAgent");
    if (!agent) {
      throw new Error("Planning agent not found");
    }

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let activitiesText = "";

    for await (const chunk of response.textStream) {
      activitiesText += chunk;
    }
    return {
      activities: activitiesText,
    };
  },
});
```

### Step to synthesize and combine indoor/outdoor activity plans

Creates a comprehensive plan that considers both options

```ts showLineNumbers copy filename="workflows/parallel-workflow.ts"
const synthesizeStep = createStep({
  id: "sythesize-step",
  description: "Synthesizes the results of the indoor and outdoor activities",
  inputSchema: z.object({
    "plan-activities": z.object({
      activities: z.string(),
    }),
    "plan-indoor-activities": z.object({
      activities: z.string(),
    }),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const indoorActivities = inputData?.["plan-indoor-activities"];
    const outdoorActivities = inputData?.["plan-activities"];

    const prompt = `Indoor activities:
      ${indoorActivities?.activities}

      Outdoor activities:
      ${outdoorActivities?.activities}

      There is a chance of rain so be prepared to do indoor activities if needed.`;

    const agent = mastra?.getAgent("synthesizeAgent");
    if (!agent) {
      throw new Error("Synthesize agent not found");
    }

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let activitiesText = "";

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});
```

### Main workflow

```ts showLineNumbers copy filename="workflows/parallel-workflow.ts"
const activityPlanningWorkflow = createWorkflow({
  id: "plan-both-workflow",
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
  steps: [fetchWeather, planActivities, planIndoorActivities, synthesizeStep],
})
  .then(fetchWeather)
  .parallel([planActivities, planIndoorActivities])
  .then(synthesizeStep)
  .commit();

export { activityPlanningWorkflow };
```

## Register Agent and Workflow instances with Mastra class

Register the agents and workflow with the mastra instance.
This is critical for enabling access to the agents within the workflow.

```ts showLineNumbers copy filename="index.ts"
import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { activityPlanningWorkflow } from "./workflows/parallel-workflow";
import { planningAgent } from "./agents/planning-agent";
import { synthesizeAgent } from "./agents/synthesize-agent";

// Initialize Mastra with required agents and workflows
// This setup enables agent access within the workflow steps
const mastra = new Mastra({
  workflows: {
    activityPlanningWorkflow,
  },
  agents: {
    planningAgent,
    synthesizeAgent,
  },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
});

export { mastra };
```

## Execute the activity planning workflow

Here, we'll get the weather workflow from the mastra instance, then create a run and execute the created run with the required inputData.

```ts showLineNumbers copy filename="exec.ts"
import { mastra } from "./";

const workflow = mastra.getWorkflow("activityPlanningWorkflow");
const run = await workflow.createRunAsync();

// Execute the workflow with a specific city
// This will run through all steps and generate activity recommendations
const result = await run.start({ inputData: { city: "Ibiza" } });
console.dir(result, { depth: null });
```

## Workflows (Legacy)

The following links provide example documentation for legacy workflows:

- [Parallel Execution with Steps](/examples/workflows_legacy/parallel-steps)


