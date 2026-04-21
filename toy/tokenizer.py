"""48-token hand-designed vocabulary for the toy GRPO model.

Two interfaces:
  - `encode_tokens(tokens: list[str]) -> list[int]`: unambiguous; used for
    corpus construction where we emit token *names* directly.
  - `decode(ids: list[int]) -> str`: produces a plain string whose surface
    form is compatible with `prompt.has_strict_format` / `prompt.parse_moves`
    — structural tags render as literal XML tags, `<space>` as " ",
    move tokens as their standard notation (U, U', U2, ...), color tokens
    as single letters (W/Y/G/B/O/R; COL_BL renders as "B").

Ambiguity note: the surface letter "B" maps to both the back-face move and
the blue color (COL_BL). We keep them as distinct token IDs (per the plan)
and resolve ambiguity at corpus-construction time by naming the token
explicitly. The decoder is non-injective on the "B" surface by design.
"""
from __future__ import annotations

# Order matters: this is the canonical token → id assignment.
VOCAB: list[str] = [
    # Special (3)
    "<pad>", "<bos>", "<eos>",
    # Structural tags (4)
    "<thinking>", "</thinking>", "<answer>", "</answer>",
    # Move tokens (18): base, prime, double × 6 faces
    "U", "U'", "U2",
    "D", "D'", "D2",
    "L", "L'", "L2",
    "R", "R'", "R2",
    "F", "F'", "F2",
    "B", "B'", "B2",
    # Whitespace + punctuation (3)
    "<space>", "<newline>", ":",
    # Color tokens (6)
    "COL_W", "COL_Y", "COL_G", "COL_BL", "COL_O", "COL_R",
    # Reasoning words (12)
    "displaced", "solved", "rotate", "face", "move", "moves",
    "clockwise", "counter", "is", "the", "a", "to",
    # Slack (2) — reserved for future extension
    "<unused0>", "<unused1>",
]
assert len(VOCAB) == 48, f"expected 48, got {len(VOCAB)}"

TOKEN_TO_ID: dict[str, int] = {tok: i for i, tok in enumerate(VOCAB)}
ID_TO_TOKEN: dict[int, str] = {i: tok for i, tok in enumerate(VOCAB)}

VOCAB_SIZE = len(VOCAB)
PAD_ID = TOKEN_TO_ID["<pad>"]
BOS_ID = TOKEN_TO_ID["<bos>"]
EOS_ID = TOKEN_TO_ID["</answer>"]  # we train on </answer> as the end-of-completion signal

# Surface-form rendering for decode(). None means "emit nothing".
_SURFACE: dict[str, str] = {
    "<pad>": "",
    "<bos>": "",
    "<eos>": "",
    "<thinking>": "<thinking>",
    "</thinking>": "</thinking>",
    "<answer>": "<answer>",
    "</answer>": "</answer>",
    "<space>": " ",
    "<newline>": "\n",
    ":": ":",
    "COL_W": "W", "COL_Y": "Y", "COL_G": "G",
    "COL_BL": "B", "COL_O": "O", "COL_R": "R",
    "<unused0>": "", "<unused1>": "",
}
# Move tokens: surface == name.
for _m in ["U", "U'", "U2", "D", "D'", "D2", "L", "L'", "L2",
          "R", "R'", "R2", "F", "F'", "F2", "B", "B'", "B2"]:
    _SURFACE[_m] = _m
# Reasoning words: surface == name.
for _w in ["displaced", "solved", "rotate", "face", "move", "moves",
          "clockwise", "counter", "is", "the", "a", "to"]:
    _SURFACE[_w] = _w


def encode_tokens(tokens: list[str]) -> list[int]:
    """Map a list of token names to IDs. Raises KeyError on unknown tokens."""
    return [TOKEN_TO_ID[t] for t in tokens]


def decode(ids: list[int]) -> str:
    """Render a list of token IDs as a plain string using _SURFACE mapping."""
    return "".join(_SURFACE[ID_TO_TOKEN[i]] for i in ids)


def decode_tokens(ids: list[int]) -> list[str]:
    """Return token names (useful for debugging / viz)."""
    return [ID_TO_TOKEN[i] for i in ids]


if __name__ == "__main__":
    # Round-trip smoke on a representative training row.
    # Scramble "R" → completion should read:
    #   <thinking>...</thinking><answer>R'</answer>
    toks = [
        "<thinking>", "<space>", "the", "<space>", "face", "<space>", "is",
        "<space>", "displaced", "<space>", "rotate", "<space>", "counter",
        "<space>", "clockwise", "</thinking>",
        "<answer>", "R'", "</answer>",
    ]
    ids = encode_tokens(toks)
    text = decode(ids)
    assert text.startswith("<thinking>"), text
    assert text.endswith("</answer>"), text
    assert "<answer>R'</answer>" in text, text

    # Verify format check passes and answer parses.
    import prompt
    assert prompt.has_strict_format(text), f"format fail: {text!r}"
    assert prompt.extract_answer(text) == "R'"
    assert prompt.parse_moves("R'") == ["R'"]
    print("tokenizer.py OK")
    print(f"  vocab_size={VOCAB_SIZE}")
    print(f"  sample text: {text!r}")
