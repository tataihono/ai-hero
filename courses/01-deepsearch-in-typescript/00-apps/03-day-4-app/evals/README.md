# Evalite Evaluations

This folder contains evaluations for testing the deep search application using Evalite.

## Setup

1. Install dependencies:
   ```bash
   pnpm add -D evalite autoevals vitest dotenv
   ```

2. Run evaluations:
   ```bash
   pnpm run evals
   ```

3. Open http://localhost:3006 to view the evaluation dashboard.

## Evaluation Files

### `initial.eval.ts`
General evaluation testing basic search functionality with common user queries.

### `search-quality.eval.ts`
Focused evaluation for testing factual accuracy and search result quality.

### `edge-cases.eval.ts`
Evaluation for testing edge cases, error handling, and unusual queries.

## Adding New Evaluations

1. Create a new `.eval.ts` file in this folder
2. Import required dependencies:
   ```ts
   import { evalite } from "evalite";
   import { Levenshtein, AnswerRelevancy } from "autoevals";
   import { askDeepSearch } from "~/deep-search";
   ```

3. Define your evaluation:
   ```ts
   evalite("Your Evaluation Name", {
     data: async () => {
       return [
         { input: "Your test query", expected: "Expected result" },
       ];
     },
     task: async (input) => {
       // Your test logic here
       return result;
     },
     scorers: [Levenshtein, AnswerRelevancy],
   });
   ```

## Available Scorers

- `Levenshtein`: Measures text similarity (no API key required)
- `AnswerRelevancy`: Evaluates answer relevance to the question (requires OpenAI API key)
- `AnswerCorrectness`: Assesses factual accuracy (requires OpenAI API key)

**Note**: The evaluations currently use only `Levenshtein` scorer to avoid requiring additional API keys. To use the other scorers, you would need to add an `OPENAI_API_KEY` to your environment variables.

## Environment Variables

Make sure your `.env` file contains the necessary API keys for:
- Google AI (for the model)
- Serper (for web search)
- Any other required services

The evaluations will automatically load environment variables from your `.env` file.

## Troubleshooting

### Port Already in Use
If you get an error about port 3006 being in use:
```bash
lsof -ti:3006 | xargs kill -9
```

### Missing API Keys
If you get errors about missing API keys:
- The evaluations currently use only `Levenshtein` scorer which doesn't require additional API keys
- If you want to use `AnswerRelevancy` or `AnswerCorrectness` scorers, add `OPENAI_API_KEY` to your `.env` file

### Environment Variables Not Loading
Make sure your `vitest.config.ts` includes:
```ts
export default defineConfig({
  test: {
    setupFiles: ["dotenv/config"],
  },
});
``` 