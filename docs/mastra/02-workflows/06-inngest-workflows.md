---
title: "Inngest Workflows | Workflows | Mastra Docs"
description: "Inngest workflow allows you to run Mastra workflows with Inngest"
---

# Inngest Workflow
[EN] Source: https://mastra.ai/en/docs/workflows/inngest-workflow

[Inngest](https://www.inngest.com/docs) is a developer platform for building and running background workflows, without managing infrastructure.

## How Inngest Works with Mastra

Inngest and Mastra integrate by aligning their workflow models: Inngest organizes logic into functions composed of steps, and Mastra workflows defined using `createWorkflow` and `createStep` map directly onto this paradigm. Each Mastra workflow becomes an Inngest function with a unique identifier, and each step within the workflow maps to an Inngest step.

The `serve` function bridges the two systems by registering Mastra workflows as Inngest functions and setting up the necessary event handlers for execution and monitoring.

When an event triggers a workflow, Inngest executes it step by step, memoizing each step’s result. This means if a workflow is retried or resumed, completed steps are skipped, ensuring efficient and reliable execution. Control flow primitives in Mastra, such as loops, conditionals, and nested workflows are seamlessly translated into the same Inngest’s function/step model, preserving advanced workflow features like composition, branching, and suspension.

Real-time monitoring, suspend/resume, and step-level observability are enabled via Inngest’s publish-subscribe system and dashboard. As each step executes, its state and output are tracked using Mastra storage and can be resumed as needed.

## Setup

```sh
npm install @mastra/inngest @mastra/core @mastra/deployer
```

## Building an Inngest Workflow

This guide walks through creating a workflow with Inngest and Mastra, demonstrating a counter application that increments a value until it reaches 10.

### Inngest Initialization

Initialize the Inngest integration to obtain Mastra-compatible workflow helpers. The createWorkflow and createStep functions are used to create workflow and step objects that are compatible with Mastra and inngest.

In development

```ts showLineNumbers copy filename="src/mastra/inngest/index.ts"
import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

export const inngest = new Inngest({
  id: "mastra",
  baseUrl:"http://localhost:3000",
  isDev: true,
  middleware: [realtimeMiddleware()],
});
```

In production

```ts showLineNumbers copy filename="src/mastra/inngest/index.ts"
import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

export const inngest = new Inngest({
  id: "mastra",
  middleware: [realtimeMiddleware()],
});
```

### Creating Steps

Define the individual steps that will compose your workflow:

```ts showLineNumbers copy filename="src/mastra/workflows/index.ts"
import { z } from "zod";
import { inngest } from "../inngest";
import { init } from "@mastra/inngest";

// Initialize Inngest with Mastra, pointing to your local Inngest server
const { createWorkflow, createStep } = init(inngest);

// Step: Increment the counter value
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
```

### Creating the Workflow

Compose the steps into a workflow using the `dountil` loop pattern. The createWorkflow function creates a function on inngest server that is invocable.

```ts showLineNumbers copy filename="src/mastra/workflows/index.ts"
// workflow that is registered as a function on inngest server
const workflow = createWorkflow({
  id: "increment-workflow",
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
}).then(incrementStep);

workflow.commit();

export { workflow as incrementWorkflow };
```

### Configuring the Mastra Instance and Executing the Workflow

Register the workflow with Mastra and configure the Inngest API endpoint:

```ts showLineNumbers copy filename="src/mastra/index.ts"
import { Mastra } from "@mastra/core/mastra";
import { serve as inngestServe } from "@mastra/inngest";
import { incrementWorkflow } from "./workflows";
import { inngest } from "./inngest";
import { PinoLogger } from "@mastra/loggers";

// Configure Mastra with the workflow and Inngest API endpoint
export const mastra = new Mastra({
  workflows: {
    incrementWorkflow,
  },
  server: {
    // The server configuration is required to allow local docker container can connect to the mastra server
    host: "0.0.0.0",
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
    ],
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
```

### Running the Workflow locally

> **Prerequisites:**
>
> - Docker installed and running
> - Mastra project set up
> - Dependencies installed (`npm install`)

1. Run `npx mastra dev` to start the Mastra server on local to serve the server on port 5000.
2. Start the Inngest Dev Server (via Docker)
   In a new terminal, run:

```sh
docker run --rm -p 3000:3000 \
  inngest/inngest \
  inngest dev -u http://host.docker.internal:5000/api/inngest
```

> **Note:** The URL after `-u` tells the Inngest dev server where to find your Mastra `/api/inngest` endpoint.

3. Open the Inngest Dashboard

- Visit [http://localhost:3000](http://localhost:3000) in your browser.
- Go to the **Apps** section in the sidebar.
- You should see your Mastra workflow registered.
  ![Inngest Dashboard](/inngest-apps-dashboard.png)

4. Invoke the Workflow

- Go to the **Functions** section in the sidebar.
- Select your Mastra workflow.
- Click **Invoke** and use the following input:

```json
{
  "data": {
    "inputData": {
      "value": 5
    }
  }
}
```

![Inngest Function](/inngest-function-dashboard.png)

5. **Monitor the Workflow Execution**

- Go to the **Runs** tab in the sidebar.
- Click on the latest run to see step-by-step execution progress.
  ![Inngest Function Run](/inngest-runs-dashboard.png)

### Running the Workflow in Production

> **Prerequisites:**
>
> - Vercel account and Vercel CLI installed (`npm i -g vercel`)
> - Inngest account
> - Vercel token (recommended: set as environment variable)

1. Add Vercel Deployer to Mastra instance

```ts showLineNumbers copy filename="src/mastra/index.ts"
import { VercelDeployer } from "@mastra/deployer-vercel";

export const mastra = new Mastra({
  // ...other config
  deployer: new VercelDeployer({
    teamSlug: "your_team_slug",
    projectName: "your_project_name",
    // you can get your vercel token from the vercel dashboard by clicking on the user icon in the top right corner
    // and then clicking on "Account Settings" and then clicking on "Tokens" on the left sidebar.
    token: "your_vercel_token",
  }),
});
```

> **Note:** Set your Vercel token in your environment:
>
> ```sh
> export VERCEL_TOKEN=your_vercel_token
> ```

2. Build the mastra instance

```sh
npx mastra build
```

3. Deploy to Vercel

```sh
cd .mastra/output
vercel --prod
```

> **Tip:** If you haven't already, log in to Vercel CLI with `vercel login`.

4. Sync with Inngest Dashboard

- Go to the [Inngest dashboard](https://app.inngest.com/env/production/apps).
- Click **Sync new app with Vercel** and follow the instructions.
- You should see your Mastra workflow registered as an app.
  ![Inngest Dashboard](/inngest-apps-dashboard-prod.png)

5. Invoke the Workflow

- In the **Functions** section, select `workflow.increment-workflow`.
- Click **All actions** (top right) > **Invoke**.
- Provide the following input:

```json
{
  "data": {
    "inputData": {
      "value": 5
    }
  }
}
```

![Inngest Function Run](/inngest-function-dashboard-prod.png)

6.  Monitor Execution

- Go to the **Runs** tab.
- Click the latest run to see step-by-step execution progress.
  ![Inngest Function Run](/inngest-runs-dashboard-prod.png)


---
title: "Inngest Workflow | Workflows | Mastra Docs"
description: Example of building an inngest workflow with Mastra
---

# Inngest Workflow
[EN] Source: https://mastra.ai/en/examples/workflows/inngest-workflow

This example demonstrates how to build an Inngest workflow with Mastra.

## Setup

```sh copy
npm install @mastra/inngest inngest @mastra/core @mastra/deployer @hono/node-server @ai-sdk/openai

docker run --rm -p 3000:3000 \
  inngest/inngest \
  inngest dev -u http://host.docker.internal:3000/inngest/api
```

Alternatively, you can use the Inngest CLI for local development by following the official [Inngest Dev Server guide](https://www.inngest.com/docs/dev-server).

## Define the Planning Agent

Define a planning agent which leverages an LLM call to plan activities given a location and corresponding weather conditions.

```ts showLineNumbers copy filename="agents/planning-agent.ts"
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// Create a new planning agent that uses the OpenAI model
const planningAgent = new Agent({
  name: "planningAgent",
  model: openai("gpt-4o"),
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

## Define the Activity Planner Workflow

Define the activity planner workflow with 3 steps: one to fetch the weather via a network call, one to plan activities, and another to plan only indoor activities.

```ts showLineNumbers copy filename="workflows/inngest-workflow.ts"
import { init } from "@mastra/inngest";
import { Inngest } from "inngest";
import { z } from "zod";

const { createWorkflow, createStep } = init(
  new Inngest({
    id: "mastra",
    baseUrl: `http://localhost:3000`,
  }),
);

// Helper function to convert weather codes to human-readable descriptions
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

#### Step 1: Fetch weather data for a given city

```ts showLineNumbers copy filename="workflows/inngest-workflow.ts"
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

    // Get latitude and longitude for the city
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${inputData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    // Fetch weather data using the coordinates
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

#### Step 2: Suggest activities (indoor or outdoor) based on weather

```ts showLineNumbers copy filename="workflows/inngest-workflow.ts"
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

#### Step 3: Suggest indoor activities only (for rainy weather)

```ts showLineNumbers copy filename="workflows/inngest-workflow.ts"
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

## Define the activity planner workflow

```ts showLineNumbers copy filename="workflows/inngest-workflow.ts"
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
    [
      // If precipitation chance is greater than 50%, suggest indoor activities
      async ({ inputData }) => {
        return inputData?.precipitationChance > 50;
      },
      planIndoorActivities,
    ],
    [
      // Otherwise, suggest a mix of activities
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

Register the agents and workflow with the mastra instance. This allows access to the agents within the workflow.

```ts showLineNumbers copy filename="index.ts"
import { Mastra } from "@mastra/core/mastra";
import { serve as inngestServe } from "@mastra/inngest";
import { PinoLogger } from "@mastra/loggers";
import { Inngest } from "inngest";
import { activityPlanningWorkflow } from "./workflows/inngest-workflow";
import { planningAgent } from "./agents/planning-agent";
import { realtimeMiddleware } from "@inngest/realtime";

// Create an Inngest instance for workflow orchestration and event handling
const inngest = new Inngest({
  id: "mastra",
  baseUrl: `http://localhost:3000`, // URL of your local Inngest server
  isDev: true,
  middleware: [realtimeMiddleware()], // Enable real-time updates in the Inngest dashboard
});

// Create and configure the main Mastra instance
export const mastra = new Mastra({
  workflows: {
    activityPlanningWorkflow,
  },
  agents: {
    planningAgent,
  },
  server: {
    host: "0.0.0.0",
    apiRoutes: [
      {
        path: "/api/inngest", // API endpoint for Inngest to send events to
        method: "ALL",
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
      },
    ],
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
```

## Execute the activity planner workflow

Here, we'll get the activity planner workflow from the mastra instance, then create a run and execute the created run with the required inputData.

```ts showLineNumbers copy filename="exec.ts"
import { mastra } from "./";
import { serve } from "@hono/node-server";
import { createHonoServer } from "@mastra/deployer/server";

const app = await createHonoServer(mastra);

// Start the server on port 3000 so Inngest can send events to it
const srv = serve({
  fetch: app.fetch,
  port: 3000,
});

const workflow = mastra.getWorkflow("activityPlanningWorkflow");
const run = await workflow.createRunAsync();

// Start the workflow with the required input data (city name)
// This will trigger the workflow steps and stream the result to the console
const result = await run.start({ inputData: { city: "New York" } });
console.dir(result, { depth: null });

// Close the server after the workflow run is complete
srv.close();
```

After running the workflow, you can view and monitor your workflow runs in real time using the Inngest dashboard at [http://localhost:3000](http://localhost:3000).

## Workflows (Legacy)

The following links provide example documentation for legacy workflows:

- [Creating a Simple Workflow (Legacy)](/examples/workflows_legacy/creating-a-workflow)


