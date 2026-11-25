# wiredown benchmark

Question: when a model reads wiredown's `AI_CONTRACT` and is asked for a screen flow, how often does the first answer lint clean and cover the request, and how often after one repair turn?

## What is measured

- 20 prompts in `prompts.json` (sign in, checkout, settings, pricing, and so on). Each names a minimum screen count, the element kinds that must appear, and links that must exist (a screen whose label contains A links to a screen whose label contains B).
- For each prompt and model: one call with the contract as the system message, then, if the answer does not pass, one repair turn that shows the lint errors.
- A pass means the block parses, has zero lint errors and meets all three checks. Variant screens do not count toward the minimum.
- Output tokens per screen, and the same screens in three encodings (wiredown, OpenUI, HTML) counted with the o200k tokenizer.
- `reference/*.wiredown` holds one hand-written answer per prompt. Each one passes its own prompt, which pins the checks.

## Free commands (no keys, no network)

```
npm install
npm test
node run.mjs --estimate --models anthropic:MODEL,openai:MODEL
node run.mjs --fake --models anthropic:fake-model --out results/fake.json
node encodings.mjs
node report.mjs results/fake.json
```

`--estimate` prints the call count (prompts x models x 2) and token totals. It shows dollars only for models you price yourself, for example `--price anthropic:MODEL=3/15` (dollars per million input and output tokens). No prices are built in because they change.

`--fake` replays `fixtures/fake-answers.json`: 14 answers that pass first time, 4 that fail first and pass after repair, 2 that fail both. It only proves the harness works. Never quote a number from a fake run as a result.

## Running it for real

A real run calls paid model APIs, so it costs money. Set the keys for the providers you use (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`), run `--estimate` first, then:

```
node run.mjs --models anthropic:MODEL,openai:MODEL,gemini:MODEL
node report.mjs results/<date>.json
```

Calls are sequential with a pause before every call (`--pause MS`, default 1000). `--max N` (default 4000) is the output token limit passed to each provider; reasoning models may need a larger one, because their thinking is spent from the same budget. The run refuses to start (exit 2) when a requested provider's key is missing, and the results file is rewritten after every row, so an interrupted run keeps what it paid for. A provider error is recorded as its status code on the row; the provider's message text is never stored.

## Reading the numbers

- Provider errors are not model failures: errored rows are left out of the pass rates and shown in the errors column.
- OpenAI's completion tokens include reasoning tokens; Gemini's `candidatesTokenCount` excludes thinking tokens. Output tokens per screen are therefore not comparable across providers without care.
- About half of the HTML column of the encodings table is the per-file CSS, so it overstates what a model would write.
- `--out`, the default `results/` folder and the report's encodings file all resolve from the `bench/` folder, not from where you run the command.

## What gets quoted

Only results files committed to `results/` (apart from `fake.json`, which is git-ignored) are quoted anywhere. `results/encodings.json` is real data: it needs no model.
