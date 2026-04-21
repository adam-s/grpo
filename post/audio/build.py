"""Generate one MP3 per symbol id in the registry (gTTS).

Writes to ../public/audio/<id>.mp3 and emits a tiny manifest.json listing
the ids it produced.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from registry import REGISTRY

SCRIPT_DIR = Path(__file__).resolve().parent
AUDIO_ROOT = SCRIPT_DIR.parent / "public" / "audio"


def generate(text: str, out_mp3: Path, force: bool) -> None:
    if out_mp3.exists() and not force:
        return
    from gtts import gTTS
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    gTTS(text=text, lang="en").save(str(out_mp3))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="generate only this id")
    args = ap.parse_args()

    try:
        import gtts  # noqa: F401
    except ImportError:
        raise SystemExit("gtts required. pip install gtts")

    AUDIO_ROOT.mkdir(parents=True, exist_ok=True)
    entries: dict[str, dict[str, str]] = {}

    for sym_id, text in REGISTRY.items():
        if args.only and sym_id != args.only:
            continue
        out = AUDIO_ROOT / f"{sym_id}.mp3"
        generate(text, out, args.force)
        entries[sym_id] = {"text": text, "file": f"{sym_id}.mp3"}
        print(f"  {sym_id:<14} → {text}")

    (AUDIO_ROOT / "manifest.json").write_text(
        json.dumps({"expressions": entries}, indent=2)
    )
    print(f"\nwrote {AUDIO_ROOT / 'manifest.json'} ({len(entries)} ids)")


if __name__ == "__main__":
    main()
