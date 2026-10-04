# Groq model choice for dining hall highlights

Researched September 29, 2026. This is a documentation review, not an evaluation of model outputs on dining menus.

Start with `openai/gpt-oss-120b` and `reasoning_effort: "low"`. The production status, strict structured output support, and identical free quotas across the three relevant models make it a reasonable default. This recommendation is an engineering judgment; the documentation does not establish which model selects the best dishes.

## Relevant models

| Model | Groq status | Advertised generation speed | Paid input / output per million tokens | Suggested role |
| --- | --- | --- | --- | --- |
| `openai/gpt-oss-120b` | Production | ~500 tokens/sec | $0.15 / $0.60 | Initial default |
| `openai/gpt-oss-20b` | Production | ~1,000 tokens/sec | $0.075 / $0.30 | Compare for a faster, cheaper option |
| `qwen/qwen3.8-27b` | Preview | ~450+ tokens/sec | $0.80 / $4.00 | Evaluate with reasoning disabled |

Sources: [Groq model catalog](https://console.groq.com/docs/models), [120B](https://console.groq.com/docs/model/openai/gpt-oss-120b), [20B](https://console.groq.com/docs/model/openai/gpt-oss-20b), [Qwen](https://console.groq.com/docs/model/qwen/qwen3.8-27b). Speeds are provider estimates, not measured request latency. Prompt processing, queueing, and generated reasoning also affect total time.

Groq labels Qwen a preview model. Its documentation says preview models are for evaluation and can be discontinued at short notice. Both GPT-OSS models appear in the production section. [Lifecycle policy](https://console.groq.com/docs/deprecations)

GPT-OSS supports low, medium, and high reasoning, defaulting to medium. Qwen supports `none`, its default, plus `default`, low, medium, and high. Its ability to disable reasoning is useful for this small selection task. Explicitly set the chosen effort to avoid depending on defaults. [Groq API reference](https://console.groq.com/docs/api-reference)

All three support strict JSON Schema output. Groq requires every field to be required and object schemas to set `additionalProperties: false`; streaming and tool use are not supported alongside structured outputs. Schema compliance does not establish that a selected dish is an appropriate main. Validate selected identifiers, duplicates, and count in application code. [Structured outputs](https://console.groq.com/docs/structured-outputs)

## Free capacity

All three have the same published free limits: 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute, and 200,000 tokens/day. Limits apply at the organization level, and account settings are authoritative. A request can hit any limit independently. Groq returns HTTP 429 and a retry-after header when throttled. [Rate limits](https://console.groq.com/docs/rate-limits)

Using the earlier planning assumption of seven halls, three meals per day, and 2,000 input plus 200 output tokens per meal gives 21 requests and 46,200 tokens/day. This is 23.1% of the token allowance, or 630 requests and 1.386 million tokens over 30 days. These are illustrative assumptions, not measured menu sizes; account for reasoning, retries, updates, and advance-date generation. Daily capacity does not accumulate into a monthly pool.

At 2,200 total tokens per request, three requests in a minute fit under 8,000 tokens; four do not. Generation should run through a paced background queue, honor rate-limit headers, and store selections by hall, date, meal, and menu-content hash. A full week generated at once would exceed 200,000 tokens under these assumptions.

A more conservative allowance of 2,000 input plus 1,000 total completion tokens, including reasoning, gives 63,000 tokens/day, or 31.5% of the daily quota. Two changed versions of every meal would use 126,000 tokens/day. At that size, pace at two requests/minute initially and adjust using actual token usage and response headers. Neither assumption is an enforced ceiling until generation limits and request sizing are configured.

For the same illustrative monthly tokens, paid inference would cost about $0.26 on 120B, $0.13 on 20B, or $1.51 on Qwen, excluding additional reasoning and retries. These figures apply if using paid pricing, not charges within the free plan.

## Decision and evaluation

120B is a sensible first deployment because free usage removes most of the economic reason to favor a smaller model at this volume. 20B is worth testing because its advertised throughput is twice as high and paid rates half as much. Qwen's non-thinking mode may reduce token consumption, but preview status makes it a less stable default. General reasoning and coding benchmarks do not resolve menu selection quality.

Compare the three on 30–50 real breakfast, lunch, and dinner menus. Judge whether each selects existing main dishes, excludes sides and condiments, represents distinct stations, avoids near-duplicates, and includes a plant-based main when one exists. Measure total tokens, failure rate, and elapsed time. Use original menu text for display; the model should return existing item identifiers.

The other supplied choices serve different tasks: Safeguard is specialized for safety classification, Prompt Guard detects prompt attacks, Orpheus generates speech, and Whisper transcribes speech. [Safeguard](https://console.groq.com/docs/model/openai/gpt-oss-safeguard-20b), [content moderation](https://console.groq.com/docs/content-moderation), [text to speech](https://console.groq.com/docs/text-to-speech), [speech to text](https://console.groq.com/docs/speech-to-text)
