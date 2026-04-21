"""Dump the trained model's state_dict to JSON for browser consumption.

Also writes config.json with architecture spec + vocabulary. Together with
weights.json this is all the browser needs to run `toy_forward.js`.
"""
from __future__ import annotations
import json
from pathlib import Path

import torch

from toy.model import ToyConfig
from toy.tokenizer import ID_TO_TOKEN


def export(ckpt_path: Path, weights_out: Path, config_out: Path):
    blob = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    cfg = ToyConfig(**blob["cfg"])
    sd = blob["model"]
    flat = {
        name: {"shape": list(tensor.shape), "data": tensor.flatten().tolist()}
        for name, tensor in sd.items()
    }
    weights_out.parent.mkdir(parents=True, exist_ok=True)
    with open(weights_out, "w") as f:
        json.dump(flat, f)
    with open(config_out, "w") as f:
        json.dump({
            "architecture": cfg.__dict__,
            "vocab": [ID_TO_TOKEN[i] for i in range(cfg.vocab_size)],
        }, f, indent=2)
    total = sum(len(v["data"]) for v in flat.values())
    size_kb = weights_out.stat().st_size / 1024
    print(f"exported {total} params ({size_kb:.1f} KB) -> {weights_out}")
    print(f"exported config -> {config_out}")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default="toy/ckpts/grpo/model.pt")
    ap.add_argument("--weights-out", default="toy/weights.json")
    ap.add_argument("--config-out", default="toy/config.json")
    args = ap.parse_args()
    export(Path(args.ckpt), Path(args.weights_out), Path(args.config_out))
