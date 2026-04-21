"""Run inference on 10 representative scrambles, dump per-layer activations.

For each scramble, we feed the concatenated prompt + ground-truth completion
through the trained model once and record, per layer:
  - attention weights [n_heads, T, T]
  - post-block hidden state [T, d_model]
  - FFN pre-projection activation [T, d_ff]

Plus the per-position full softmax over the vocab (so the viz can show the
48-tall bar chart without re-running the model in JS).

Output: toy/activations.json
"""
from __future__ import annotations
import json
from pathlib import Path

import torch
import torch.nn.functional as F

from toy.gen_corpus import SCRAMBLES, prompt_tokens
from toy.model import ToyConfig, ToyTransformer
from toy.tokenizer import EOS_ID, ID_TO_TOKEN, decode, encode_tokens


def greedy_generate(model, prompt_ids: list[int], max_new_tokens: int = 40) -> list[int]:
    """Greedy (argmax) generation, stops at EOS. Returns the full sequence."""
    device = next(model.parameters()).device
    seq = list(prompt_ids)
    with torch.no_grad():
        for _ in range(max_new_tokens):
            ids = torch.tensor([seq], dtype=torch.long, device=device)
            logits = model(ids)[0, -1, :]
            tok = int(logits.argmax().item())
            seq.append(tok)
            if tok == EOS_ID:
                break
    return seq


def capture(ckpt_path: Path, out_path: Path, scrambles: list[str] | None = None):
    blob = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    cfg = ToyConfig(**blob["cfg"])
    model = ToyTransformer(cfg)
    model.load_state_dict(blob["model"])
    model.eval()

    if scrambles is None:
        # 10 representative: all 6 quarter-CW + 4 primes/doubles for variety.
        scrambles = ["U", "D", "L", "R", "F", "B", "U'", "R'", "F2", "L2"]

    records = []
    for s in scrambles:
        p_toks = prompt_tokens(s)
        p_ids = encode_tokens(p_toks)
        # Generate greedily so attention maps reflect what the model ACTUALLY
        # produces, not how it reads a reference completion (red-team P1).
        full_ids = greedy_generate(model, p_ids)
        all_toks = [ID_TO_TOKEN[i] for i in full_ids]
        ids = torch.tensor([full_ids], dtype=torch.long)
        caps: list[dict] = []
        with torch.no_grad():
            logits = model(ids, capture_layers=caps)
        probs = F.softmax(logits[0].float(), dim=-1)  # [T, V]

        records.append({
            "scramble": s,
            "tokens": all_toks,
            "completion_text": decode(full_ids[len(p_ids):]),
            "prompt_len": len(p_toks),
            "layers": [
                {
                    "attn": caps[li]["attn"][0].tolist(),      # [H, T, T]
                    "hidden": caps[li]["hidden"][0].tolist(),  # [T, d_model]
                    "ffn": caps[li]["ffn"][0].tolist(),        # [T, d_ff]
                }
                for li in range(cfg.n_layers)
            ],
            "softmax": probs.tolist(),  # [T, V]
        })

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"scrambles": records, "config": cfg.__dict__,
                   "vocab": [ID_TO_TOKEN[i] for i in range(cfg.vocab_size)]}, f)
    size_kb = out_path.stat().st_size / 1024
    print(f"captured {len(records)} scrambles -> {out_path} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default="toy/ckpts/grpo/model.pt")
    ap.add_argument("--out", default="toy/activations.json")
    args = ap.parse_args()
    capture(Path(args.ckpt), Path(args.out))
