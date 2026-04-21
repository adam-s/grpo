"""SFT on the toy k=1 corpus.

Full-weight AdamW. Loss = cross-entropy on completion tokens only (prompt
tokens are masked out). Produces toy/ckpts/sft/model.pt and a brief
per-epoch loss log.
"""
from __future__ import annotations
import os
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from toy.gen_corpus import build_corpus
from toy.model import ToyConfig, ToyTransformer
from toy.tokenizer import PAD_ID, VOCAB_SIZE


CKPT_DIR = Path("toy/ckpts/sft")


def collate(rows: list[dict]):
    """Pad to the max length in the batch. Returns:
      input_ids [B, L], target_ids [B, L], loss_mask [B, L] (1 on completion, 0 elsewhere).
    """
    seqs, masks = [], []
    for r in rows:
        seq = r["prompt_ids"] + r["completion_ids"]
        # Mask: 0 for prompt tokens, 1 for completion tokens.
        m = [0] * len(r["prompt_ids"]) + [1] * len(r["completion_ids"])
        seqs.append(seq)
        masks.append(m)
    L = max(len(s) for s in seqs)
    padded = [s + [PAD_ID] * (L - len(s)) for s in seqs]
    padded_m = [m + [0] * (L - len(m)) for m in masks]
    ids = torch.tensor(padded, dtype=torch.long)
    mask = torch.tensor(padded_m, dtype=torch.float)
    return ids, mask


def compute_loss(model, ids, mask):
    logits = model(ids)  # [B, L, V]
    # Shift: predict token t+1 from position t.
    shift_logits = logits[:, :-1, :].contiguous()
    shift_targets = ids[:, 1:].contiguous()
    shift_mask = mask[:, 1:].contiguous()
    # Cross-entropy per token.
    ce = F.cross_entropy(
        shift_logits.reshape(-1, shift_logits.size(-1)),
        shift_targets.reshape(-1),
        reduction="none",
    ).reshape(shift_targets.shape)
    loss = (ce * shift_mask).sum() / shift_mask.sum().clamp(min=1.0)
    return loss


def train(epochs: int = 25, batch_size: int = 8, lr: float = 1e-3, seed: int = 0):
    torch.manual_seed(seed)
    cfg = ToyConfig()
    model = ToyTransformer(cfg)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    rows = build_corpus(copies=1)
    loader = DataLoader(rows, batch_size=batch_size, shuffle=True, collate_fn=collate)

    model.train()
    for ep in range(1, epochs + 1):
        total, n = 0.0, 0
        for ids, mask in loader:
            loss = compute_loss(model, ids, mask)
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            total += loss.item() * ids.size(0)
            n += ids.size(0)
        avg = total / n
        if ep == 1 or ep % 10 == 0 or ep == epochs:
            ppl = torch.tensor(avg).exp().item()
            print(f"epoch {ep:3d}  loss {avg:.4f}  ppl {ppl:.3f}")

    CKPT_DIR.mkdir(parents=True, exist_ok=True)
    ckpt_path = CKPT_DIR / "model.pt"
    torch.save({"model": model.state_dict(), "cfg": cfg.__dict__}, ckpt_path)
    print(f"saved {ckpt_path}")
    return model, avg


if __name__ == "__main__":
    train()
