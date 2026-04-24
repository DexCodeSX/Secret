# models — what bonsai router actually accepts

> **⚠️ HONEST UPDATE 2026-04-24 (v2.5.14):** the previous v2.5.7 claim of "fixed_routing_model: opus-4.7" was wrong. live statsig dump shows the actual stealth pool A/B's across:
>
> - **anthropic**: opus-4.5, opus-4.6 (with reasoning high/low), sonnet-4.5, sonnet-4.6
> - **z-ai**: glm-4.6, glm-4.7 (rotated across openrouter providers)
> - **minimax**: m2.1
>
> **no `claude-opus-4.7` in the actual pool right now.** the response field is literally `display_name: "stealth"` — UI is designed to hide which model you got. all 199 model names below are accepted for client compat (so cline/cursor/codex don't crash on unknown model), but every request maps into the stealth pool.
>
> still useful: bonsai = free frontier-class model access with 1M context. just don't expect a *specific* model — you get whatever the A/B test serves you that request. verify with `bon statsig`.

tested 213 model names from litellm catalog against `go.trybons.ai` via api.js (v2.4.0). **199 accepted by router** (no 4xx), 14 timed out.

all responses come back as `model: "stealth"` — confirmed via statsig that the actual backend is the stealth pool above (not a single model).

date: 2026-04-23

---

## summary

| family | working | examples |
|---|---|---|
| OpenAI | 75 | `gpt-3.5-turbo`, `gpt-3.5-turbo-1106`, `gpt-3.5-turbo-instruct` |
| Gemini | 29 | `gemini-2.0-flash`, `gemini-2.0-flash-001`, `gemini-2.0-flash-lite` |
| Claude | 21 | `claude-3-7-sonnet-20250219`, `claude-3-haiku-20240307`, `claude-3-opus-20240229` |
| Llama | 13 | `perplexity/codellama-34b-instruct`, `perplexity/codellama-70b-instruct`, `perplexity/llama-2-70b-chat` |
| DeepSeek | 11 | `deepseek-chat`, `deepseek-reasoner`, `deepseek-v3-2-251201` |
| Perplexity | 11 | `perplexity/pplx-70b-chat`, `perplexity/pplx-7b-chat`, `perplexity/pplx-7b-online` |
| Qwen | 9 | `together_ai/Qwen/Qwen2.5-72B-Instruct-Turbo`, `together_ai/Qwen/Qwen2.5-7B-Instruct-Turbo`, `together_ai/Qwen/Qwen3-235B-A22B-Instruct-2507-tput` |
| Cohere | 8 | `command-a-03-2025`, `command-light`, `command-nightly` |
| Mistral | 7 | `codestral/codestral-2405`, `codestral/codestral-latest`, `perplexity/mistral-7b-instruct` |
| MiniMax | 5 | `minimax/MiniMax-M2`, `minimax/MiniMax-M2.1`, `minimax/MiniMax-M2.1-lightning` |
| GLM (Z-AI) | 4 | `glm-4-7-251222`, `together_ai/zai-org/GLM-4.5-Air-FP8`, `together_ai/zai-org/GLM-4.6` |
| Kimi | 4 | `kimi-k2-thinking-251104`, `together_ai/moonshotai/Kimi-K2-Instruct`, `together_ai/moonshotai/Kimi-K2-Instruct-0905` |
| gpt-oss | 2 | `together_ai/openai/gpt-oss-120b`, `together_ai/openai/gpt-oss-20b` |

**total working: 199 / 213 tested**

---

## OpenAI (75)

- `gpt-3.5-turbo`
- `gpt-3.5-turbo-1106`
- `gpt-3.5-turbo-instruct`
- `gpt-3.5-turbo-instruct-0914`
- `gpt-4`
- `gpt-4-0125-preview`
- `gpt-4-0314`
- `gpt-4-0613`
- `gpt-4-1106-preview`
- `gpt-4-turbo`
- `gpt-4-turbo-2024-04-09`
- `gpt-4-turbo-preview`
- `gpt-4.1`
- `gpt-4.1-2025-04-14`
- `gpt-4.1-mini`
- `gpt-4.1-mini-2025-04-14`
- `gpt-4.1-nano`
- `gpt-4.1-nano-2025-04-14`
- `gpt-4o`
- `gpt-4o-2024-05-13`
- `gpt-4o-2024-11-20`
- `gpt-4o-audio-preview-2024-12-17`
- `gpt-4o-audio-preview-2025-06-03`
- `gpt-4o-mini`
- `gpt-4o-mini-2024-07-18`
- `gpt-4o-mini-audio-preview`
- `gpt-4o-mini-audio-preview-2024-12-17`
- `gpt-4o-mini-realtime-preview`
- `gpt-4o-mini-realtime-preview-2024-12-17`
- `gpt-4o-mini-search-preview`
- `gpt-4o-mini-search-preview-2025-03-11`
- `gpt-4o-realtime-preview`
- `gpt-4o-realtime-preview-2025-06-03`
- `gpt-5`
- `gpt-5-2025-08-07`
- `gpt-5-chat`
- `gpt-5-chat-latest`
- `gpt-5-mini`
- `gpt-5-mini-2025-08-07`
- `gpt-5-nano`
- `gpt-5-nano-2025-08-07`
- `gpt-5-search-api`
- `gpt-5-search-api-2025-10-14`
- `gpt-5.1`
- `gpt-5.1-2025-11-13`
- `gpt-5.1-chat-latest`
- `gpt-5.2`
- `gpt-5.2-2025-12-11`
- `gpt-5.2-chat-latest`
- `gpt-5.3-chat-latest`
- `gpt-5.4`
- `gpt-5.4-2026-03-05`
- `gpt-5.4-mini`
- `gpt-5.4-nano`
- `gpt-audio`
- `gpt-audio-1.5`
- `gpt-audio-2025-08-28`
- `gpt-audio-mini`
- `gpt-audio-mini-2025-10-06`
- `gpt-audio-mini-2025-12-15`
- `gpt-realtime`
- `gpt-realtime-1.5`
- `gpt-realtime-2025-08-28`
- `gpt-realtime-mini`
- `gpt-realtime-mini-2025-10-06`
- `gpt-realtime-mini-2025-12-15`
- `o1`
- `o1-2024-12-17`
- `o3`
- `o3-2025-04-16`
- `o3-mini`
- `o3-mini-2025-01-31`
- `o4-mini`
- `o4-mini-2025-04-16`
- `openai/container`

## Gemini (29)

- `gemini-2.0-flash`
- `gemini-2.0-flash-001`
- `gemini-2.0-flash-lite`
- `gemini-2.0-flash-lite-001`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.5-flash-lite-preview-06-17`
- `gemini-2.5-flash-lite-preview-09-2025`
- `gemini-2.5-flash-native-audio-preview-09-2025`
- `gemini-2.5-flash-native-audio-preview-12-2025`
- `gemini-2.5-flash-preview-09-2025`
- `gemini-2.5-pro`
- `gemini-2.5-pro-preview-tts`
- `gemini-3-pro-preview`
- `gemini-3.1-flash-lite-preview`
- `gemini-3.1-flash-live-preview`
- `gemini-3.1-pro-preview`
- `gemini-3.1-pro-preview-customtools`
- `gemini-pro-latest`
- `gemini/gemini-3-flash-preview`
- `gemini/gemini-exp-1114`
- `gemini/gemini-exp-1206`
- `gemini/gemini-flash-latest`
- `gemini/gemini-flash-lite-latest`
- `gemini/gemini-gemma-2-27b-it`
- `gemini/gemini-gemma-2-9b-it`
- `gemini/gemma-3-27b-it`
- `gemini/learnlm-1.5-pro-experimental`
- `gemini/lyria-3-clip-preview`

## Claude (21)

- `claude-3-7-sonnet-20250219`
- `claude-3-haiku-20240307`
- `claude-3-opus-20240229`
- `claude-4-opus-20250514`
- `claude-4-sonnet-20250514`
- `claude-haiku-4-5`
- `claude-haiku-4-5-20251001`
- `claude-opus-4-1`
- `claude-opus-4-1-20250805`
- `claude-opus-4-20250514`
- `claude-opus-4-5`
- `claude-opus-4-5-20251101`
- `claude-opus-4-6`
- `claude-opus-4-6-20260205`
- `claude-opus-4-7`
- `claude-opus-4-7-20260416`
- `claude-sonnet-4-20250514`
- `claude-sonnet-4-5`
- `claude-sonnet-4-5-20250929`
- `claude-sonnet-4-5-20250929-v1:0`
- `claude-sonnet-4-6`

## Llama (13)

- `perplexity/codellama-34b-instruct`
- `perplexity/codellama-70b-instruct`
- `perplexity/llama-2-70b-chat`
- `perplexity/llama-3.1-70b-instruct`
- `perplexity/llama-3.1-8b-instruct`
- `together_ai/meta-llama/Llama-3.2-3B-Instruct-Turbo`
- `together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo`
- `together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo-Free`
- `together_ai/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`
- `together_ai/meta-llama/Llama-4-Scout-17B-16E-Instruct`
- `together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`
- `together_ai/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`
- `together_ai/togethercomputer/CodeLlama-34b-Instruct`

## DeepSeek (11)

- `deepseek-chat`
- `deepseek-reasoner`
- `deepseek-v3-2-251201`
- `deepseek/deepseek-coder`
- `deepseek/deepseek-r1`
- `deepseek/deepseek-v3`
- `deepseek/deepseek-v3.2`
- `together_ai/deepseek-ai/DeepSeek-R1`
- `together_ai/deepseek-ai/DeepSeek-R1-0528-tput`
- `together_ai/deepseek-ai/DeepSeek-V3`
- `together_ai/deepseek-ai/DeepSeek-V3.1`

## Perplexity (11)

- `perplexity/pplx-70b-chat`
- `perplexity/pplx-7b-chat`
- `perplexity/pplx-7b-online`
- `perplexity/sonar`
- `perplexity/sonar-medium-chat`
- `perplexity/sonar-medium-online`
- `perplexity/sonar-pro`
- `perplexity/sonar-reasoning`
- `perplexity/sonar-reasoning-pro`
- `perplexity/sonar-small-chat`
- `perplexity/sonar-small-online`

## Qwen (9)

- `together_ai/Qwen/Qwen2.5-72B-Instruct-Turbo`
- `together_ai/Qwen/Qwen2.5-7B-Instruct-Turbo`
- `together_ai/Qwen/Qwen3-235B-A22B-Instruct-2507-tput`
- `together_ai/Qwen/Qwen3-235B-A22B-Thinking-2507`
- `together_ai/Qwen/Qwen3-235B-A22B-fp8-tput`
- `together_ai/Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8`
- `together_ai/Qwen/Qwen3-Next-80B-A3B-Instruct`
- `together_ai/Qwen/Qwen3-Next-80B-A3B-Thinking`
- `together_ai/Qwen/Qwen3.5-397B-A17B`

## Cohere (8)

- `command-a-03-2025`
- `command-light`
- `command-nightly`
- `command-r`
- `command-r-08-2024`
- `command-r-plus`
- `command-r-plus-08-2024`
- `command-r7b-12-2024`

## Mistral (7)

- `codestral/codestral-2405`
- `codestral/codestral-latest`
- `perplexity/mistral-7b-instruct`
- `perplexity/mixtral-8x7b-instruct`
- `together_ai/mistralai/Mistral-7B-Instruct-v0.1`
- `together_ai/mistralai/Mistral-Small-24B-Instruct-2501`
- `together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1`

## MiniMax (5)

- `minimax/MiniMax-M2`
- `minimax/MiniMax-M2.1`
- `minimax/MiniMax-M2.1-lightning`
- `minimax/MiniMax-M2.5`
- `minimax/MiniMax-M2.5-lightning`

## GLM (Z-AI) (4)

- `glm-4-7-251222`
- `together_ai/zai-org/GLM-4.5-Air-FP8`
- `together_ai/zai-org/GLM-4.6`
- `together_ai/zai-org/GLM-4.7`

## Kimi (4)

- `kimi-k2-thinking-251104`
- `together_ai/moonshotai/Kimi-K2-Instruct`
- `together_ai/moonshotai/Kimi-K2-Instruct-0905`
- `together_ai/moonshotai/Kimi-K2.5`

## gpt-oss (2)

- `together_ai/openai/gpt-oss-120b`
- `together_ai/openai/gpt-oss-20b`

---

## failed (14)

all of these timed out at 25s. could be slow-responding models (Perplexity online search, Llama 3.1 405B), audio/realtime models that need different request format, or deprecated models.

| model | status | reason |
|---|---|---|
| `gemini-robotics-er-1.5-preview` | 0 | This operation was aborted |
| `gemini-2.5-computer-use-preview-10-2025` | 0 | This operation was aborted |
| `gemini/lyria-3-pro-preview` | 0 | This operation was aborted |
| `gpt-3.5-turbo-0125` | 0 | This operation was aborted |
| `gpt-3.5-turbo-16k` | 0 | This operation was aborted |
| `gpt-4o-2024-08-06` | 0 | This operation was aborted |
| `gpt-4o-audio-preview` | 0 | This operation was aborted |
| `gpt-4o-realtime-preview-2024-12-17` | 0 | This operation was aborted |
| `gpt-4o-search-preview` | 0 | This operation was aborted |
| `gpt-4o-search-preview-2025-03-11` | 0 | This operation was aborted |
| `perplexity/pplx-70b-online` | 0 | This operation was aborted |
| `perplexity/sonar-deep-research` | 0 | This operation was aborted |
| `together_ai/meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo` | 0 | This operation was aborted |
| `gemini-2.5-flash-native-audio-latest` | 0 | This operation was aborted |

---

## takeaways

- bonsai markets itself as "free claude" but the router accepts ~everything OpenRouter does
- you can use **GPT-5, Gemini 2.5/3.1, DeepSeek, Qwen3.5-397B, GLM-4.7, Kimi K2.5, Mixtral, CodeLlama, gpt-oss-120b, Cohere command, MiniMax m2.1** — all free thru `bon api`
- 1M context modifier: append `[1m]` to opus models (`claude-opus-4-6[1m]`)
- everything counts against the same 20M tokens/day cap regardless of model
- router returns `model: "stealth"` always — no way to verify which provider actually ran ur request

## test method

- pulled litellm catalog: `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`
- filtered to 213 plausible models (skip bedrock/vertex/azure/etc cloud-specific paths)
- fired `POST /v1/messages` with prompt "hi", max_tokens=8, concurrency 8
- success = HTTP 200 + non-empty content text
- total cost: 210K input + 1.6K output (1% of daily 20M cap)
