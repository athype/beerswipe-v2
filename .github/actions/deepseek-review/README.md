# deepseek-review (vendored)

Vendored copy of [hustcer/deepseek-review](https://github.com/hustcer/deepseek-review)
at commit [`c9f59718ab3579ee1c8e8c9d29147d5b8f811123`](https://github.com/hustcer/deepseek-review/commit/c9f59718ab3579ee1c8e8c9d29147d5b8f811123)
(MIT license, see `LICENSE`), used by `.github/workflows/deepseek-pr-review.yml`.

One deliberate change, in `nu/review.nu`:

```
thinking: { type: 'disabled' }  ->  thinking: { type: 'enabled' }
```

DeepSeek v4 models ship thinking mode on by default; the upstream action
hardcodes it off and exposes no input for it. Enabling it lets the reviewer
deliberate before writing findings.

To update: re-copy the files from a newer upstream commit and re-apply the
one-line change. To drop the vendor: point the workflow back at the upstream
action pinned by SHA and delete this directory.
