"""Tiny thinking-block generator restricted to the 48-token vocab.

The real `rich_reasoning.py` emits English words, numbers, and cubie position
labels (UFR, UR, ...) — none of which exist in the toy vocab. This module
generates a short, in-vocab thinking block tailored to k=1 scrambles: it names
the displaced face, describes the rotation direction, then states the inverse
move. The output is returned as a list of token *names* (not IDs) so
`toy/gen_corpus.py` can splice it between structural tags and encode the
whole sequence with `tokenizer.encode_tokens`.

Multiple thinking-block variants per scramble provide SFT entropy so the
policy retains stochasticity at generation time — essential for GRPO to
produce within-group reward variance.
"""
from __future__ import annotations

# Map face letter → color token name for the centre sticker of that face.
# (Standard Western colour scheme.)
_FACE_COLOR = {
    "U": "COL_W", "D": "COL_Y", "F": "COL_G",
    "B": "COL_BL", "L": "COL_O", "R": "COL_R",
}

# Map move suffix → direction words from the toy vocab (12 reasoning words).
#   ""  (quarter CW)          -> "clockwise"
#   "'" (quarter CCW)         -> "counter clockwise"
#   "2" (half turn)           -> "clockwise clockwise" (kept in-vocab)
def _direction_tokens(suffix: str) -> list[str]:
    if suffix == "":
        return ["clockwise"]
    if suffix == "'":
        return ["counter", "<space>", "clockwise"]
    if suffix == "2":
        return ["clockwise", "<space>", "clockwise"]
    raise ValueError(f"bad suffix {suffix!r}")


def _invert_suffix(suffix: str) -> str:
    return {"": "'", "'": "", "2": "2"}[suffix]


def _thinking_variant_0(face: str, suffix: str, col: str) -> list[str]:
    """'the <col> face is displaced : rotate <inv_dir>'"""
    inv_dir = _direction_tokens(_invert_suffix(suffix))
    return [
        "the", "<space>", col, "<space>", "face", "<space>",
        "is", "<space>", "displaced", "<space>", ":", "<space>",
        "rotate", "<space>",
    ] + inv_dir


def _thinking_variant_1(face: str, suffix: str, col: str) -> list[str]:
    """'rotate <col> face <inv_dir>'"""
    inv_dir = _direction_tokens(_invert_suffix(suffix))
    return [
        "rotate", "<space>", col, "<space>", "face", "<space>",
    ] + inv_dir


def _thinking_variant_2(face: str, suffix: str, col: str) -> list[str]:
    """'<col> displaced : rotate <inv_dir> to solved'"""
    inv_dir = _direction_tokens(_invert_suffix(suffix))
    return [
        col, "<space>", "displaced", "<space>", ":", "<space>",
        "rotate", "<space>",
    ] + inv_dir + ["<space>", "to", "<space>", "solved"]


def _thinking_variant_3(face: str, suffix: str, col: str) -> list[str]:
    """'face <col> is displaced : move <inv_dir>'"""
    inv_dir = _direction_tokens(_invert_suffix(suffix))
    return [
        "face", "<space>", col, "<space>",
        "is", "<space>", "displaced", "<space>", ":", "<space>",
        "move", "<space>",
    ] + inv_dir


_VARIANT_FNS = [
    _thinking_variant_0,
    _thinking_variant_1,
    _thinking_variant_2,
    _thinking_variant_3,
]

NUM_VARIANTS = len(_VARIANT_FNS)


def thinking_tokens(scramble_move: str, variant: int = 0) -> list[str]:
    """Return a list of token names forming the <thinking>…</thinking> body,
    including the outer tags. Input is a single face move like "R", "U'", "F2".
    variant selects among NUM_VARIANTS different phrasings (all semantically
    equivalent, all passing has_strict_format).
    """
    assert len(scramble_move) >= 1 and scramble_move[0] in _FACE_COLOR, scramble_move
    face = scramble_move[0]
    suffix = scramble_move[1:]
    col = _FACE_COLOR[face]
    body = _VARIANT_FNS[variant % NUM_VARIANTS](face, suffix, col)
    return ["<thinking>"] + body + ["</thinking>"]


def answer_tokens(scramble_move: str) -> list[str]:
    """Return token names for <answer>inverse_move</answer>."""
    face = scramble_move[0]
    suffix = scramble_move[1:]
    inv = face + _invert_suffix(suffix)
    return ["<answer>", inv, "</answer>"]


def completion_tokens(scramble_move: str, variant: int = 0) -> list[str]:
    """Full completion: thinking + answer, all in-vocab."""
    return thinking_tokens(scramble_move, variant=variant) + answer_tokens(scramble_move)


def all_completion_variants(scramble_move: str) -> list[list[str]]:
    """Return all NUM_VARIANTS completions for a scramble."""
    return [completion_tokens(scramble_move, v) for v in range(NUM_VARIANTS)]


if __name__ == "__main__":
    import prompt
    from toy.tokenizer import encode_tokens, decode

    for mv in ["U", "U'", "U2", "R", "R'", "R2", "F2", "B'", "D"]:
        for v in range(NUM_VARIANTS):
            toks = completion_tokens(mv, variant=v)
            text = decode(encode_tokens(toks))
            assert prompt.has_strict_format(text), (mv, v, text)
            ans = prompt.extract_answer(text)
            moves = prompt.parse_moves(ans)
            import cube
            state = cube.apply_moves(cube.SOLVED, mv)
            final = cube.apply_moves(state, " ".join(moves))
            assert cube.is_solved(final), f"{mv} v{v} -> {ans} didn't solve"
    print(f"toy_reasoning.py OK ({NUM_VARIANTS} variants × 9 moves)")
    for v in range(NUM_VARIANTS):
        text = decode(encode_tokens(completion_tokens("R", variant=v)))
        print(f"  v{v}: {text!r}")
