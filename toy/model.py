"""Llama-style tiny decoder for the toy GRPO model.

Architecture (see docs/toy-model-plan.md):
  n_layers=2, n_heads=4, d_model=64, d_ff=128, head_dim=16, vocab=48, max_seq=256.
RMSNorm, RoPE, SwiGLU FFN, tied LM head. Single forward pass returns raw logits
`[batch, seq, vocab]`. Caller shifts by 1 to get next-token log-probs, matching
the convention in train_grpo.py::compute_logprobs.
"""
from __future__ import annotations
import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class ToyConfig:
    vocab_size: int = 48
    d_model: int = 64
    n_layers: int = 2
    n_heads: int = 4
    d_ff: int = 128
    max_seq_len: int = 256
    rope_base: float = 10000.0

    @property
    def head_dim(self) -> int:
        return self.d_model // self.n_heads


class RMSNorm(nn.Module):
    def __init__(self, d: int, eps: float = 1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(d))
        self.eps = eps

    def forward(self, x):
        norm = x.pow(2).mean(-1, keepdim=True).add(self.eps).rsqrt()
        return self.weight * (x * norm)


def _rope_cache(seq_len: int, head_dim: int, base: float, device, dtype):
    inv_freq = 1.0 / (base ** (torch.arange(0, head_dim, 2, device=device).float() / head_dim))
    t = torch.arange(seq_len, device=device).float()
    freqs = torch.outer(t, inv_freq)  # [T, head_dim/2]
    cos = freqs.cos().to(dtype)
    sin = freqs.sin().to(dtype)
    return cos, sin


def _apply_rope(x, cos, sin):
    # x: [B, H, T, head_dim]. Split into even/odd along head_dim.
    x1 = x[..., 0::2]
    x2 = x[..., 1::2]
    # cos/sin: [T, head_dim/2]
    rot1 = x1 * cos - x2 * sin
    rot2 = x1 * sin + x2 * cos
    out = torch.stack([rot1, rot2], dim=-1).flatten(-2)
    return out


class Attention(nn.Module):
    def __init__(self, cfg: ToyConfig):
        super().__init__()
        self.cfg = cfg
        self.q = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.k = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.v = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.o = nn.Linear(cfg.d_model, cfg.d_model, bias=False)

    def forward(self, x, cos, sin, capture=None):
        B, T, D = x.shape
        H, Hd = self.cfg.n_heads, self.cfg.head_dim
        q = self.q(x).view(B, T, H, Hd).transpose(1, 2)  # [B,H,T,Hd]
        k = self.k(x).view(B, T, H, Hd).transpose(1, 2)
        v = self.v(x).view(B, T, H, Hd).transpose(1, 2)
        q = _apply_rope(q, cos, sin)
        k = _apply_rope(k, cos, sin)
        scores = q @ k.transpose(-2, -1) / math.sqrt(Hd)  # [B,H,T,T]
        mask = torch.triu(torch.ones(T, T, device=x.device, dtype=torch.bool), diagonal=1)
        scores = scores.masked_fill(mask, float("-inf"))
        attn = F.softmax(scores, dim=-1)
        if capture is not None:
            capture["attn"] = attn.detach()
        y = attn @ v  # [B,H,T,Hd]
        y = y.transpose(1, 2).reshape(B, T, D)
        return self.o(y)


class SwiGLU(nn.Module):
    def __init__(self, cfg: ToyConfig):
        super().__init__()
        self.gate = nn.Linear(cfg.d_model, cfg.d_ff, bias=False)
        self.up = nn.Linear(cfg.d_model, cfg.d_ff, bias=False)
        self.down = nn.Linear(cfg.d_ff, cfg.d_model, bias=False)

    def forward(self, x, capture=None):
        a = F.silu(self.gate(x)) * self.up(x)
        if capture is not None:
            capture["ffn"] = a.detach()
        return self.down(a)


class Block(nn.Module):
    def __init__(self, cfg: ToyConfig):
        super().__init__()
        self.n1 = RMSNorm(cfg.d_model)
        self.attn = Attention(cfg)
        self.n2 = RMSNorm(cfg.d_model)
        self.ffn = SwiGLU(cfg)

    def forward(self, x, cos, sin, capture=None):
        x = x + self.attn(self.n1(x), cos, sin, capture=capture)
        x = x + self.ffn(self.n2(x), capture=capture)
        if capture is not None:
            capture["hidden"] = x.detach()
        return x


class ToyTransformer(nn.Module):
    def __init__(self, cfg: ToyConfig):
        super().__init__()
        self.cfg = cfg
        self.embed = nn.Embedding(cfg.vocab_size, cfg.d_model)
        self.blocks = nn.ModuleList([Block(cfg) for _ in range(cfg.n_layers)])
        self.final_norm = RMSNorm(cfg.d_model)
        # Tied LM head: weight shared with embedding via functional linear.

    def forward(self, input_ids: torch.Tensor, capture_layers: list | None = None):
        B, T = input_ids.shape
        assert T <= self.cfg.max_seq_len, f"seq {T} > max {self.cfg.max_seq_len}"
        x = self.embed(input_ids)
        cos, sin = _rope_cache(T, self.cfg.head_dim, self.cfg.rope_base, x.device, x.dtype)
        for i, block in enumerate(self.blocks):
            cap = {} if capture_layers is not None else None
            x = block(x, cos, sin, capture=cap)
            if capture_layers is not None:
                capture_layers.append(cap)
        x = self.final_norm(x)
        logits = F.linear(x, self.embed.weight)  # tied
        return logits

    def num_params(self) -> int:
        return sum(p.numel() for p in self.parameters())


if __name__ == "__main__":
    cfg = ToyConfig()
    m = ToyTransformer(cfg)
    print(f"toy model: {m.num_params()} params")
    x = torch.randint(0, cfg.vocab_size, (2, 32))
    y = m(x)
    assert y.shape == (2, 32, cfg.vocab_size), y.shape
    # Capture smoke:
    caps = []
    y2 = m(x, capture_layers=caps)
    assert len(caps) == cfg.n_layers
    assert caps[0]["attn"].shape == (2, cfg.n_heads, 32, 32)
    assert caps[0]["hidden"].shape == (2, 32, cfg.d_model)
    assert caps[0]["ffn"].shape == (2, 32, cfg.d_ff)
    print("model.py OK")
