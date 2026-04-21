"""Enumerate the 18 k=1 scrambles and produce (prompt_ids, completion_ids) pairs.

Prompt format — minimal and in-vocab. The toy vocab lacks cubie position
names (UFR, UR, ...), so we cannot render real cubie state. Instead the
prompt shows the scramble move wrapped in <bos>/<eos>, and the model learns
to emit the inverse in its <answer> block.

  prompt:     <bos> <scramble_move> :
  completion: <thinking>...</thinking><answer>inverse</answer>

Note: we intentionally do NOT use the `<eos>` token in the prompt. The
completion terminator for rollout/sampling is `</answer>` (see
`tokenizer.EOS_ID`). Keeping `<eos>` unused avoids ambiguity between
prompt-side separators and generation-halt signals.

The completion is what `reward.reward_one` scores — the prompt is never
seen by the reward function. The scramble string passed to `reward_one`
is the canonical cube-notation form (e.g. "R"), not the tokenised prompt.
"""
from __future__ import annotations

from toy.tokenizer import encode_tokens
from toy.toy_reasoning import NUM_VARIANTS, completion_tokens

FACES = ["U", "D", "L", "R", "F", "B"]
SUFFIXES = ["", "'", "2"]
SCRAMBLES: list[str] = [f + s for f in FACES for s in SUFFIXES]
assert len(SCRAMBLES) == 18


def random_scramble(k: int, rng) -> str:
    """Generate a k-move scramble with distinct consecutive faces,
    so partial progress (inverting some moves) is meaningful."""
    moves = []
    prev_face = None
    for _ in range(k):
        avail = [f for f in FACES if f != prev_face]
        face = rng.choice(avail)
        moves.append(face + rng.choice(SUFFIXES))
        prev_face = face
    return " ".join(moves)


def prompt_tokens(scramble: str) -> list[str]:
    """Tokenise a scramble string into prompt tokens.
    k=1: ['<bos>', "R'", ':']
    k=2: ['<bos>', 'R', "U'", ':']  — each move is its own token."""
    moves = scramble.split()
    return ["<bos>"] + moves + [":"]


def make_row(scramble_move: str, variant: int = 0) -> dict:
    p = prompt_tokens(scramble_move)
    c = completion_tokens(scramble_move, variant=variant)
    return {
        "scramble": scramble_move,
        "prompt_ids": encode_tokens(p),
        "completion_ids": encode_tokens(c),
        "prompt_tokens": p,
        "completion_tokens": c,
    }


def build_corpus(copies: int = 1) -> list[dict]:
    """Each scramble × each variant × copies. Default copies=1 gives
    18 scrambles × 4 variants = 72 rows — enough diversity for SFT
    to learn the format without memorizing a single phrasing."""
    rows = []
    for _ in range(copies):
        for s in SCRAMBLES:
            for v in range(NUM_VARIANTS):
                rows.append(make_row(s, variant=v))
    return rows


if __name__ == "__main__":
    rows = build_corpus()
    print(f"corpus: {len(rows)} rows ({len(SCRAMBLES)} scrambles × {NUM_VARIANTS} variants)")
    for i in range(min(NUM_VARIANTS, len(rows))):
        r = rows[i]
        print(f"  [{i}] scramble={r['scramble']}  completion_tokens={r['completion_tokens']}")
