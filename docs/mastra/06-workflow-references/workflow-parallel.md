---
title: "Reference: Workflow.parallel() | Building Workflows | Mastra Docs"
description: Documentation for the `.parallel()` method in workflows, which executes multiple steps in parallel.
---

# Workflow.parallel()
[EN] Source: https://mastra.ai/en/reference/workflows/parallel

The `.parallel()` method executes multiple steps in parallel.

## Usage

```typescript
workflow.parallel([stepOne, stepTwo]);
```

## Parameters

<PropertiesTable
  content={[
    {
      name: "steps",
      type: "Step[]",
      description: "The step instances to execute in parallel",
      isOptional: false,
    },
  ]}
/>

## Returns

<PropertiesTable
  content={[
    {
      name: "workflow",
      type: "Workflow",
      description: "The workflow instance for method chaining",
    },
  ]}
/>

## Related

- [Parallel workflow example](../../examples/workflows/parallel-steps.mdx)


