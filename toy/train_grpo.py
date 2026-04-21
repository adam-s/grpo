"""GRPO on the toy model — schema-compatible with train_grpo.py.

Differences vs. the main loop:
  - No PEFT/LoRA: full-weight training of a ~85k-param model.
  - No HF AutoTokenizer / AutoModel: uses toy/tokenizer.py + toy/model.py.
  - No adaptive curriculum: fixed k=1. Curriculum fields are logged with
    fixed values so the viz code that parses trajectory.jsonl.gz from the
    main run works unchanged.
  - Custom sampler (top-p/temperature) over toy forward pass.

Trajectory schema matches train_grpo.py lines 305–347 exactly. All tokens
are integer IDs from the 48-token vocab; completion text is the decoded
surface form, which is what reward.reward_one scores.
"""
from __future__ import annotations
import argparse
import copy
import gzip
import json
import math
import random
import time
from pathlib import Path

import torch
import torch.nn.functional as F

import grpo_core
import reward as reward_mod
from toy.gen_corpus import SCRAMBLES, prompt_tokens, random_scramble
from toy.model import ToyConfig, ToyTransformer
from toy.tokenizer import EOS_ID, ID_TO_TOKEN, VOCAB_SIZE, decode, encode_tokens


# Probe prompt used every detail step to measure "what this gradient step
# nudged" — a fixed scramble re-scored under (previous, current) policies.
# Picked as a 2-move scramble not in SCRAMBLES (so it has non-trivial structure
# but won't be trained on directly).
PROBE_SCRAMBLE = "R U"


def _capture_block_activations(model: ToyTransformer, ids: torch.Tensor, block_i: int = 0):
    """Run `ids` through `model` and capture per-token activations at each
    labelled sub-layer (embed, q/k/v/o, gate/up/down, final_norm, logit).

    Returns a dict `{name: [T, dim]}` for the single batch row. Uses forward
    hooks on nn.Linear modules so no model.py changes are needed.
    """
    captures: dict[str, torch.Tensor] = {}
    handles = []

    def hook(name: str):
        def fn(_mod, _inp, out):
            # out is [B, T, D]; take batch 0.
            captures[name] = out.detach()[0]
        return fn

    blk = model.blocks[block_i]
    handles.append(blk.attn.q.register_forward_hook(hook("q")))
    handles.append(blk.attn.k.register_forward_hook(hook("k")))
    handles.append(blk.attn.v.register_forward_hook(hook("v")))
    handles.append(blk.attn.o.register_forward_hook(hook("o")))
    handles.append(blk.ffn.gate.register_forward_hook(hook("gate")))
    handles.append(blk.ffn.up.register_forward_hook(hook("up")))
    handles.append(blk.ffn.down.register_forward_hook(hook("down")))
    handles.append(model.embed.register_forward_hook(hook("embed")))
    handles.append(model.final_norm.register_forward_hook(hook("final_norm")))

    model.eval()
    with torch.no_grad():
        logits = model(ids)  # [1, T, V]
    for h in handles:
        h.remove()
    captures["logits"] = logits.detach()[0]  # [T, V]
    return captures


def _compute_probe(model: ToyTransformer, probe_ids: list[int],
                   answer_ids: list[int]) -> list[float]:
    """Return per-token log π(answer_t | prompt + answer_<t) under `model`.

    Deterministic — we score the given `answer_ids` sequence rather than sampling.
    """
    device = next(model.parameters()).device
    seq = torch.tensor([probe_ids + answer_ids], dtype=torch.long, device=device)
    prompt_len = len(probe_ids)
    model.eval()
    with torch.no_grad():
        logits = model(seq)  # [1, L, V]
    shift_logits = logits[:, prompt_len - 1 : -1, :]
    targets = seq[:, prompt_len:]
    lp = F.log_softmax(shift_logits.float(), dim=-1)
    chosen = lp.gather(-1, targets.unsqueeze(-1)).squeeze(-1)  # [1, T_answer]
    return chosen[0].tolist()


def load_policy_and_ref(sft_ckpt: Path):
    """Load the SFT checkpoint as policy (trainable) and frozen reference."""
    blob = torch.load(sft_ckpt, map_location="cpu", weights_only=False)
    cfg = ToyConfig(**blob["cfg"])
    policy = ToyTransformer(cfg)
    policy.load_state_dict(blob["model"])
    ref = ToyTransformer(cfg)
    ref.load_state_dict(blob["model"])
    for p in ref.parameters():
        p.requires_grad_(False)
    ref.eval()
    return cfg, policy, ref


def sample_rollouts(model, prompt_ids: list[int], G: int, max_new_tokens: int,
                    temperature: float, top_p: float) -> tuple[torch.Tensor, int]:
    """Generate G completions for one prompt. Uses top-p sampling.

    Stops a given row's generation at EOS (</answer>). All rows share the same
    output length (pad to the longest). Returns (seq_ids [G, L], prompt_len).
    """
    device = next(model.parameters()).device
    prompt_len = len(prompt_ids)
    # Each row independently grows. We track per-row live flag; once EOS emitted, pad.
    rows = [list(prompt_ids) for _ in range(G)]
    done = [False] * G
    model.eval()
    with torch.no_grad():
        for _ in range(max_new_tokens):
            if all(done):
                break
            # Pad to current max length across live rows (all rows currently share length).
            ids = torch.tensor(rows, dtype=torch.long, device=device)
            logits = model(ids)[:, -1, :] / max(temperature, 1e-6)
            # Top-p filter.
            probs = F.softmax(logits, dim=-1)
            sorted_probs, sorted_idx = probs.sort(dim=-1, descending=True)
            cum = sorted_probs.cumsum(dim=-1)
            cutoff = cum > top_p
            # Shift right so at least one token always kept.
            cutoff[..., 1:] = cutoff[..., :-1].clone()
            cutoff[..., 0] = False
            sorted_probs = sorted_probs.masked_fill(cutoff, 0.0)
            sorted_probs = sorted_probs / sorted_probs.sum(dim=-1, keepdim=True)
            chosen_sorted = torch.multinomial(sorted_probs, num_samples=1)  # [G,1]
            chosen = sorted_idx.gather(-1, chosen_sorted).squeeze(-1)  # [G]
            for g in range(G):
                if done[g]:
                    rows[g].append(EOS_ID)  # pad with EOS; masked out downstream
                else:
                    tok = chosen[g].item()
                    rows[g].append(tok)
                    if tok == EOS_ID:
                        done[g] = True
    seq_ids = torch.tensor(rows, dtype=torch.long, device=device)
    return seq_ids, prompt_len


def compute_logprobs(model, seq_ids: torch.Tensor, prompt_len: int) -> torch.Tensor:
    """Same shift convention as train_grpo.py::compute_logprobs."""
    logits = model(seq_ids)
    shift_logits = logits[:, prompt_len - 1 : -1, :]
    shift_targets = seq_ids[:, prompt_len:]
    log_probs = F.log_softmax(shift_logits.float(), dim=-1)
    return log_probs.gather(-1, shift_targets.unsqueeze(-1)).squeeze(-1)


def build_mask(seq_ids: torch.Tensor, prompt_len: int, eos_id: int) -> torch.Tensor:
    """1 on completion tokens up to and including first EOS, 0 after."""
    completion = seq_ids[:, prompt_len:]
    G, T = completion.shape
    mask = torch.ones(G, T, dtype=torch.float32, device=completion.device)
    for g in range(G):
        pos = (completion[g] == eos_id).nonzero(as_tuple=True)[0]
        if len(pos) > 0:
            cutoff = pos[0].item() + 1
            if cutoff < T:
                mask[g, cutoff:] = 0.0
    return mask


def extract_key_position_probs(model, prompt_ids: list[int], top_k: int = 20):
    """Top-k probs at first generation position. Tokens rendered as names (not decoded surface)."""
    device = next(model.parameters()).device
    ids = torch.tensor([prompt_ids], dtype=torch.long, device=device)
    model.eval()
    with torch.no_grad():
        logits = model(ids)[0, -1, :]
    probs = F.softmax(logits.float(), dim=-1)
    top_probs, top_ids = probs.topk(min(top_k, VOCAB_SIZE))
    return [[ID_TO_TOKEN[int(i)], float(p)] for i, p in zip(top_ids, top_probs)]


def train(args):
    torch.manual_seed(args.seed)
    rng = random.Random(args.seed)

    sft_ckpt = Path(args.sft_ckpt)
    cfg, policy, ref_model = load_policy_and_ref(sft_ckpt)
    device = torch.device("cpu")  # toy is CPU-only by design
    policy.to(device)
    ref_model.to(device)

    optim = torch.optim.AdamW(policy.parameters(), lr=args.lr, weight_decay=0.01)

    run_dir = Path(args.run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)
    traj_path = run_dir / "trajectory.jsonl.gz"
    acts_path = run_dir / "activations_trajectory.jsonl.gz"
    weights_series_path = run_dir / "weights_series.json"
    meta_path = run_dir / "run_meta.json"
    meta_path.write_text(json.dumps({
        "toy": True,
        "model_id": "toy",
        "device": "cpu",
        "dtype": "float32",
        "cfg": cfg.__dict__,
        "sft_ckpt": str(sft_ckpt),
        "G": args.G, "k_max": args.k_max, "hard_frac": args.hard_frac, "lr": args.lr,
        "beta_kl": args.beta_kl, "clip_eps": args.clip_eps,
        "ppo_epochs": args.ppo_epochs,
        "temperature": args.temperature, "top_p": args.top_p,
        "max_prompt_len": 4,
        "max_new_tokens": args.max_new_tokens, "steps": args.steps, "seed": args.seed,
    }, indent=2))

    traj_f = gzip.open(traj_path, "wt")
    acts_f = gzip.open(acts_path, "wt")

    # Probe setup: a fixed scramble re-scored every detail step.
    probe_p_tok_names = prompt_tokens(PROBE_SCRAMBLE)
    probe_p_ids = encode_tokens(probe_p_tok_names)
    # Deterministic answer to score: greedy-decode from current policy once,
    # then keep that sequence fixed so delta across steps is apples-to-apples.
    with torch.no_grad():
        probe_model = policy
        cur = list(probe_p_ids)
        for _ in range(16):
            ids_t = torch.tensor([cur], dtype=torch.long, device=device)
            nxt = int(probe_model(ids_t)[0, -1, :].argmax().item())
            cur.append(nxt)
            if nxt == EOS_ID:
                break
        probe_answer_ids = cur[len(probe_p_ids):]
        probe_answer_names = [ID_TO_TOKEN[int(t)] for t in probe_answer_ids]

    # Previous-detail-step policy snapshot (for probe delta).
    prev_policy_state = copy.deepcopy(policy.state_dict())
    prev_policy = ToyTransformer(cfg).to(device)

    # Weight-series snapshots (sparse over training). Stored in memory, written
    # at end. Shape-compatible with weights.json: {param_name: {shape, data}}.
    weights_series: dict[str, dict] = {}

    def snapshot_weights(step_id: int):
        sd = policy.state_dict()
        weights_series[str(step_id)] = {
            name: {"shape": list(t.shape), "data": [round(float(x), 4) for x in t.flatten().tolist()]}
            for name, t in sd.items()
        }

    for step in range(args.steps):
        # Snapshot weights at the *start* of the step (= the weights that
        # produced this step's rollouts, before the PPO update is applied).
        if step % args.snapshot_every == 0:
            snapshot_weights(step)
        t0 = time.time()
        # Curriculum: ramp from k=1-only to mixed k=1..k_max over training.
        # Fraction of non-k=1 steps ramps linearly; when a higher-k step is
        # chosen, k is sampled uniformly from [2, current_k_cap]. This gives
        # a natural difficulty staircase and creates the reward gradient the
        # viz needs (partial progress at k>1, binary solve/fail at k=1).
        progress = step / max(1, args.steps - 1)
        hard_frac = args.hard_frac * min(1.0, progress / 0.3)
        k_cap = min(args.k_max, 2 + int(progress * (args.k_max - 1)))
        if rng.random() < hard_frac and k_cap >= 2:
            k = rng.randint(2, k_cap)
            scramble = random_scramble(k, rng)
        else:
            scramble = rng.choice(SCRAMBLES)
            k = 1
        p_tok_names = prompt_tokens(scramble)
        p_ids = encode_tokens(p_tok_names)
        prompt_text_readable = " ".join(p_tok_names)

        seq_ids, prompt_len = sample_rollouts(
            policy, p_ids, args.G, args.max_new_tokens,
            args.temperature, args.top_p,
        )
        completions_text = [decode(seq_ids[g, prompt_len:].tolist()) for g in range(args.G)]
        breakdowns = reward_mod.reward_batch([scramble] * args.G, completions_text)
        rewards = torch.tensor([b.total for b in breakdowns], dtype=torch.float32, device=device)

        # Snapshot the sampling-time policy (π_old) and frozen reference.
        # `logprobs_old` is frozen for the duration of the inner PPO loop, so ratios
        # = exp(new - old) drift away from 1.0 as we take successive gradient steps.
        with torch.no_grad():
            logprobs_old = compute_logprobs(policy, seq_ids, prompt_len).detach()
            logprobs_ref = compute_logprobs(ref_model, seq_ids, prompt_len).detach()

        mask = build_mask(seq_ids, prompt_len, EOS_ID)

        is_detail_step_pre = (step % args.log_detail_every == 0) or (step == args.steps - 1)

        # PPO inner loop: K mini-epochs on the SAME sampled group. The last iteration's
        # `out` is what we log, so ratios + clipped_ratio reflect cumulative drift.
        out = None
        grad_norm = float("nan")
        exemplar_caps = None
        probe_lp_curr: list[float] | None = None
        for _inner in range(args.ppo_epochs):
            policy.train()
            logprobs_new = compute_logprobs(policy, seq_ids, prompt_len)
            out = grpo_core.grpo_loss(
                logprobs_new, logprobs_old, logprobs_ref,
                rewards, mask, clip_eps=args.clip_eps, beta_kl=args.beta_kl,
            )
            # On the last inner epoch, capture exemplar activations + probe
            # logprobs with the *exact same weights* that produced logprobs_new.
            # This is what makes `chosen_logprobs` in activations_trajectory
            # match `new_logprobs` in trajectory exactly (modulo float rounding).
            if _inner == args.ppo_epochs - 1 and is_detail_step_pre:
                focus_g = next((g for g in range(args.G) if breakdowns[g].solved > 0), 0)
                exemplar_ids = seq_ids[focus_g : focus_g + 1, :]
                exemplar_caps = _capture_block_activations(policy, exemplar_ids, block_i=0)
                probe_lp_curr = _compute_probe(policy, probe_p_ids, probe_answer_ids)
                policy.train()
            if torch.isnan(out.loss) or torch.isinf(out.loss):
                optim.zero_grad()
                continue
            out.loss.backward()
            grad_norm = torch.nn.utils.clip_grad_norm_(
                policy.parameters(), max_norm=args.max_grad_norm
            ).item()
            if math.isfinite(grad_norm):
                optim.step()
            optim.zero_grad()

        dt = time.time() - t0
        step_success = sum(1 for b in breakdowns if b.solved > 0) / len(breakdowns)
        key_probs = extract_key_position_probs(policy, p_ids)
        is_detail_step = (step % args.log_detail_every == 0) or (step == args.steps - 1)

        print(
            f"step {step:3d} scr={scramble:3s} "
            f"mean={rewards.mean().item():.3f} succ={step_success:.2f} "
            f"loss={out.loss.item():.4f} clip_frac={out.clip_fraction.item():.3f} "
            f"dt={dt:.2f}s"
        )

        step_record: dict = {
            "step": step,
            "scramble": scramble,
            "k": k,
            "k_configured": k_cap,
            "success_ema": step_success,  # toy: no EMA, just per-step
            "bumped": 0,
            "tier": "detail" if is_detail_step else "summary",
            "rewards": rewards.tolist(),
            "reward_components": [b.asdict() for b in breakdowns],
            "advantages": out.advantage.tolist(),
            "group_stats": {
                "reward_mean": rewards.mean().item(),
                "reward_std": rewards.std(unbiased=True).item(),
                "clip_fraction": out.clip_fraction.item(),
                "kl_to_ref": (out.per_token_kl.detach() * mask).sum().item() / mask.sum().clamp(min=1).item(),
            },
            "step_stats": {
                "loss": float(out.loss.item()),
                "grad_norm": grad_norm,
                "lr": args.lr,
                "wall_time_s": dt,
            },
            "key_position_probs": key_probs,
            "prompt_tokens": p_tok_names,
            # Always include brief per-rollout summary (text preview + token count)
            # so non-detail steps still have enough for the training scrubber.
            "rollout_previews": [
                {
                    "text_preview": completions_text[g][:80],
                    "n_tokens": int(mask[g].sum().item()),
                    "solved": bool(breakdowns[g].solved > 0),
                }
                for g in range(args.G)
            ],
        }
        if is_detail_step:
            # For viz: full softmax at first-generation position (the answer token position)
            # so the browser can show "what 48 tokens did the model consider?" without
            # running inference in JS.
            with torch.no_grad():
                policy.eval()
                ids_for_probs = seq_ids[:, :prompt_len]  # just the prompt for all G
                logits_at_prompt = policy(ids_for_probs)[:, -1, :]  # [G, V]
                new_probs_at_first = F.softmax(logits_at_prompt.float(), dim=-1)  # [G, V]
                ref_ids = seq_ids[:, :prompt_len]
                ref_logits_at_prompt = ref_model(ref_ids)[:, -1, :]
                ref_probs_at_first = F.softmax(ref_logits_at_prompt.float(), dim=-1)  # [G, V]
            step_record["completions"] = [
                {
                    "text": completions_text[g],
                    "token_ids": seq_ids[g, prompt_len:].tolist(),
                    # human-readable token names alongside IDs
                    "token_names": [ID_TO_TOKEN[int(tid)] for tid in seq_ids[g, prompt_len:].tolist()],
                    "new_logprobs": [round(x, 4) for x in logprobs_new.detach()[g].tolist()],
                    "ref_logprobs": [round(x, 4) for x in logprobs_ref[g].tolist()],
                    "ratios": [round(x, 4) for x in out.ratio.detach()[g].tolist()],
                    "clipped": [round(x, 4) for x in out.clipped_ratio.detach()[g].tolist()],
                    "kl_per_tok": [round(x, 6) for x in out.per_token_kl.detach()[g].tolist()],
                    "mask": mask[g].tolist(),
                    # full 48-token probability at the first generation step
                    # (= what the policy thinks the answer will START with)
                    "first_tok_new_probs": [round(float(p), 5) for p in new_probs_at_first[g].tolist()],
                    "first_tok_ref_probs": [round(float(p), 5) for p in ref_probs_at_first[g].tolist()],
                }
                for g in range(args.G)
            ]

            # Probe: re-score the fixed probe under (prev, curr) policy so the
            # post can show "what this update nudged" at step 11 (Gradient Step).
            # `probe_lp_curr` was captured inside the PPO loop with the weights
            # that produced this step's reported new_logprobs.
            prev_policy.load_state_dict(prev_policy_state)
            lp_prev = _compute_probe(prev_policy, probe_p_ids, probe_answer_ids)
            lp_curr = probe_lp_curr if probe_lp_curr is not None else _compute_probe(policy, probe_p_ids, probe_answer_ids)
            step_record["probe"] = {
                "scramble": PROBE_SCRAMBLE,
                "tokens": probe_answer_names,
                "logprobs_curr": [round(x, 4) for x in lp_curr],
                "logprobs_prev": [round(x, 4) for x in lp_prev],
                "delta": [round(c - p, 4) for c, p in zip(lp_curr, lp_prev)],
            }
            prev_policy_state = copy.deepcopy(policy.state_dict())

            # Exemplar token-flow trace: one focused rollout, all T tokens,
            # per-layer activations. `exemplar_caps` was captured inside the
            # PPO loop (weights aligned with new_logprobs in trajectory).
            focus_g = next((g for g in range(args.G) if breakdowns[g].solved > 0), 0)
            caps = exemplar_caps
            comp_mask = mask[focus_g].tolist()
            # For each completion position t, the "chosen logit" (log π of the
            # realized token under the full softmax). This is the direct bridge
            # into new_logprobs[focus_g, t] downstream.
            chosen_logprobs: list[float] = []
            logits_full = caps["logits"]  # [L, V]
            lp_full = F.log_softmax(logits_full.float(), dim=-1)
            comp_token_ids = seq_ids[focus_g, prompt_len:].tolist()
            for t, tid in enumerate(comp_token_ids):
                # position in the full sequence that predicts token t of the completion
                pos = prompt_len - 1 + t
                chosen_logprobs.append(round(float(lp_full[pos, tid].item()), 4))
            # Slice activations to completion positions only (drop prompt).
            def _slice_act(x: torch.Tensor) -> list[list[float]]:
                # x: [L, D]. Return completion slice, rounded.
                sub = x[prompt_len:].tolist()
                return [[round(float(v), 4) for v in row] for row in sub]
            acts_record = {
                "step": step,
                "g": focus_g,
                "T": len(comp_token_ids),
                "tokens": [ID_TO_TOKEN[int(tid)] for tid in comp_token_ids],
                "mask": comp_mask,
                "activations": {
                    "embed": _slice_act(caps["embed"]),
                    "q":     _slice_act(caps["q"]),
                    "k":     _slice_act(caps["k"]),
                    "v":     _slice_act(caps["v"]),
                    "o":     _slice_act(caps["o"]),
                    "gate":  _slice_act(caps["gate"]),
                    "up":    _slice_act(caps["up"]),
                    "down":  _slice_act(caps["down"]),
                    "final_norm": _slice_act(caps["final_norm"]),
                },
                "chosen_logprobs": chosen_logprobs,
            }
            acts_f.write(json.dumps(acts_record) + "\n")
            acts_f.flush()
        traj_f.write(json.dumps(step_record) + "\n")
        traj_f.flush()

    traj_f.close()
    acts_f.close()

    # Final snapshot so viewers scrubbed to the last step see post-training
    # weights.
    final_step = args.steps - 1
    if str(final_step) not in weights_series:
        snapshot_weights(final_step)
    with open(weights_series_path, "w") as f:
        json.dump({
            "schema": 1,
            "steps": sorted(int(s) for s in weights_series.keys()),
            "snapshots": weights_series,
        }, f, separators=(",", ":"))
    ws_kb = weights_series_path.stat().st_size / 1024
    print(f"saved {weights_series_path} ({ws_kb:.1f} KB, {len(weights_series)} snapshots)")

    ckpt_dir = Path("toy/ckpts/grpo")
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    torch.save({"model": policy.state_dict(), "cfg": cfg.__dict__}, ckpt_dir / "model.pt")
    print(f"saved {ckpt_dir/'model.pt'}")


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sft-ckpt", default="toy/ckpts/sft/model.pt")
    ap.add_argument("--run-dir", default="toy/runs/grpo")
    ap.add_argument("--steps", type=int, default=100)
    ap.add_argument("--G", type=int, default=8)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--beta-kl", type=float, default=0.04)
    ap.add_argument("--clip-eps", type=float, default=0.2)
    ap.add_argument("--ppo-epochs", type=int, default=4,
                    help="PPO inner-loop gradient steps per sampled group. >=2 to get non-trivial ratios.")
    ap.add_argument("--max-new-tokens", type=int, default=60)
    ap.add_argument("--temperature", type=float, default=1.2)
    ap.add_argument("--top-p", type=float, default=0.98)
    ap.add_argument("--max-grad-norm", type=float, default=0.5)
    ap.add_argument("--log-detail-every", type=int, default=10)
    ap.add_argument("--snapshot-every", type=int, default=50,
                    help="How often (in training steps) to snapshot policy weights into weights_series.json.")
    ap.add_argument("--hard-frac", type=float, default=0.5,
                    help="Max fraction of steps that use k>1 scrambles (ramped in over first 30%% of training).")
    ap.add_argument("--k-max", type=int, default=5,
                    help="Maximum scramble depth. Curriculum ramps from k=2 to k-max over training.")
    ap.add_argument("--seed", type=int, default=0)
    return ap.parse_args()


if __name__ == "__main__":
    train(parse_args())
