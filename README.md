# GRPO Explainer & Toy Model

https://github.com/user-attachments/assets/7785b09d-d886-4edf-b144-c43772ca88bd

Welcome to the GRPO project! This repository contains a deep dive into **Group Relative Policy Optimization (GRPO)**, featuring both an interactive web-based explainer and a functional toy implementation in Python.

## 🚀 Project Overview

The project is split into two main components:

### 1. `post/` - The Interactive Explainer
A visual, interactive article explaining the inner workings of GRPO, built with Svelte and Vite. It breaks down the math, models, and training loops into digestible, animated sections.

**Key concepts covered:**
- Group Sampling
- Advantage Calculation & Policy Ratios
- Clipping & Pessimistic Min
- Replicating the GRPO Objective

**To run the explainer locally:**
```bash
cd post
npm install
npm run dev
```

### 2. `toy/` - The Toy Implementation
A Python-based playground for experimenting with GRPO. It includes scripts to train a miniature model via Supervised Fine-Tuning (SFT) and then apply GRPO. It also exports weights and activations to power the frontend visualizations.

**Key files:**
- `model.py`: Architecture of the toy model.
- `train_grpo.py`: The core GRPO training loop.
- `sft.py`: Supervised fine-tuning script.
- `export_weights.py` / `capture.py`: Utilities to export model data to the web explainer.

**To run the toy model:**
```bash
cd toy
# Ensure you have your Python environment set up (e.g., venv, conda)
# Run the training script
python train_grpo.py
```

## 🧠 What is GRPO?
GRPO (Group Relative Policy Optimization) is an advanced reinforcement learning algorithm used to align language models. Unlike PPO, it evaluates a *group* of outputs generated from the same prompt and computes relative advantages, often removing the need for a separate value model and saving significant memory.

---

*Note: This repository is intended for educational purposes, providing a sandbox to understand the mechanics of reasoning models and RLHF/RLAIF techniques.*
