---
title: "Reference: Workflow.sleepUntil() | Building Workflows | Mastra Docs"
description: Documentation for the `.sleepUntil()` method in workflows, which pauses execution until a specified date.
---

# Workflow.sleepUntil()
[EN] Source: https://mastra.ai/en/reference/workflows/sleepUntil

The `.sleepUntil()` method pauses execution until a specified date.

## Usage

```typescript
workflow.sleepUntil(new Date(Date.now() + 1000));
```

## Parameters

<PropertiesTable
  content={[
    {
      name: "date",
      type: "Date",
      description: "The date until which to pause execution",
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

- [Sleep & Events](../../docs/workflows/pausing-execution.mdx)


