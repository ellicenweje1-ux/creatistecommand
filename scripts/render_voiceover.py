#!/usr/bin/env python3
"""One-time voiceover render for the landing-page intro film.

Produces two files the intro film picks up automatically:
    frontend/public/vo.mp3   — the recorded narration (~70s)
    frontend/public/vo.json  — per-scene cue points (start/end seconds)

Both are generated from the single source of truth at
frontend/src/vo-script.json (the same file the film reads its captions from,
so the spoken words and the on-screen captions can never drift apart). The
voice is rendered with ElevenLabs, using its character-level timestamps to
place each scene's cue precisely.

The film treats this recording as its primary voice and falls back to the
browser's speech synthesis when these files are absent — so the site works
with or without this step. Commit the produced files; re-run only when the
script or the chosen voice changes.

--------------------------------------------------------------------------
Usage
--------------------------------------------------------------------------
    export ELEVENLABS_API_KEY=sk_...                 # required
    export ELEVENLABS_VOICE_ID=Xb7hH8MSUJpSbSDYk0k2  # optional (default: Alice, en-GB female)
    export ELEVENLABS_MODEL=eleven_multilingual_v2   # optional
    python scripts/render_voiceover.py

    python scripts/render_voiceover.py --list-voices # print your voices + IDs to choose from
    python scripts/render_voiceover.py --dry-run     # print the script + cues plan, no API call

Run it on a machine with internet access (it calls api.elevenlabs.io) — not
inside the sandboxed build. No third-party Python packages are required.
"""

import base64
import datetime as _dt
import json
import os
import sys
import urllib.error
import urllib.request

API_ROOT = "https://api.elevenlabs.io/v1"
# Alice — a warm, confident British (en-GB) female ElevenLabs preset. Override
# with ELEVENLABS_VOICE_ID. A few other en-GB female presets you can paste:
#   Lily     pFZP5JQG7iQjIQuC4Bku
#   Charlotte XB0fDUnXU5powFXDhCwa
# Use --list-voices to see every voice on your own account with its ID.
DEFAULT_VOICE_ID = "Xb7hH8MSUJpSbSDYk0k2"
DEFAULT_MODEL = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"
SCENE_SEP = "\n\n"  # joins scenes in one request; also reads as a short pause

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SCRIPT_JSON = os.path.join(REPO, "frontend", "src", "vo-script.json")
PUBLIC_DIR = os.path.join(REPO, "frontend", "public")
OUT_MP3 = os.path.join(PUBLIC_DIR, "vo.mp3")
OUT_JSON = os.path.join(PUBLIC_DIR, "vo.json")


def load_scenes():
    with open(SCRIPT_JSON, encoding="utf-8") as fh:
        data = json.load(fh)
    scenes = data.get("scenes") or []
    if not scenes:
        sys.exit(f"No scenes found in {SCRIPT_JSON}")
    for s in scenes:
        if not s.get("key") or not s.get("speech"):
            sys.exit(f"Scene missing key/speech: {s!r}")
    return scenes


def build_text(scenes):
    """Concatenate the per-scene speech, recording where each scene starts so
    its cue can be read back from the character timestamps."""
    text = ""
    offsets = []  # first-character index of each scene within `text`
    for i, s in enumerate(scenes):
        offsets.append(len(text))
        text += s["speech"]
        if i < len(scenes) - 1:
            text += SCENE_SEP
    return text, offsets


def _request(method, url, headers, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", "replace")
        msg = body
        try:
            msg = json.dumps(json.loads(body), indent=2)
        except Exception:
            pass
        if err.code == 401:
            hint = "Check ELEVENLABS_API_KEY."
        elif err.code in (404, 422):
            hint = "Check ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL — run --list-voices to see valid IDs."
        elif err.code == 429:
            hint = "Rate-limited or out of credits on your ElevenLabs plan."
        else:
            hint = ""
        sys.exit(f"ElevenLabs API error {err.code}: {hint}\n{msg}")
    except urllib.error.URLError as err:
        sys.exit(f"Network error reaching ElevenLabs: {err.reason}\n"
                 "Run this on a machine with internet access (not the sandboxed build).")


def list_voices(api_key):
    status, body = _request("GET", f"{API_ROOT}/voices", {"xi-api-key": api_key})
    voices = json.loads(body).get("voices", [])
    print(f"{'voice_id':<24}  name / accent")
    print("-" * 60)
    for v in voices:
        labels = v.get("labels") or {}
        accent = labels.get("accent") or labels.get("gender") or ""
        print(f"{v.get('voice_id', ''):<24}  {v.get('name', '')}  {('· ' + accent) if accent else ''}")


def cue_starts(offsets, alignment, text, total):
    """Map each scene's first-character offset to a start time. Uses ElevenLabs'
    character timestamps when they line up with our text; otherwise falls back
    to a proportional estimate by character position."""
    starts_arr = alignment.get("character_start_times_seconds") if alignment else None
    chars = alignment.get("characters") if alignment else None
    aligned = bool(starts_arr) and chars is not None and len(chars) == len(text)
    if not aligned:
        print("  ! timestamps didn't line up with the input — using a proportional estimate.")
    out = []
    for off in offsets:
        if aligned:
            idx = min(off, len(starts_arr) - 1)
            out.append(round(float(starts_arr[idx]), 3))
        else:
            out.append(round(total * (off / max(1, len(text))), 3))
    return out


def render(api_key, voice_id, model):
    scenes = load_scenes()
    text, offsets = build_text(scenes)
    print(f"Rendering {len(scenes)} scenes · {len(text)} chars · voice {voice_id} · {model}")

    url = f"{API_ROOT}/text-to-speech/{voice_id}/with-timestamps?output_format={OUTPUT_FORMAT}"
    headers = {"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"}
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True},
    }
    _, body = _request("POST", url, headers, payload)
    result = json.loads(body)

    audio = result.get("audio_base64")
    if not audio:
        sys.exit("No audio in the ElevenLabs response.")
    audio_bytes = base64.b64decode(audio)

    alignment = result.get("alignment") or {}
    ends = alignment.get("character_end_times_seconds") or []
    total = round(float(ends[-1]), 3) if ends else sum(s["dur"] for s in scenes) / 1000.0

    starts = cue_starts(offsets, alignment, text, total)
    cues = []
    for i, s in enumerate(scenes):
        start = starts[i]
        end = starts[i + 1] if i + 1 < len(scenes) else total
        cues.append({"key": s["key"], "start": start, "end": round(end, 3)})

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(OUT_MP3, "wb") as fh:
        fh.write(audio_bytes)
    meta = {
        "dur": total,
        "voiceId": voice_id,
        "model": model,
        "generatedAt": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "cues": cues,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")

    print(f"\n✓ Wrote {OUT_MP3}  ({len(audio_bytes) / 1024:.0f} KB)")
    print(f"✓ Wrote {OUT_JSON}  (total {total:.1f}s)")
    print("\nScene cues:")
    for c in cues:
        print(f"  {c['key']:<11} {c['start']:>6.2f}s → {c['end']:>6.2f}s")
    print("\nCommit both files. The film will use them automatically; delete them to revert to TTS.")


def dry_run():
    scenes = load_scenes()
    text, offsets = build_text(scenes)
    print(f"{len(scenes)} scenes, {len(text)} chars total. Concatenated narration:\n")
    print(text)
    print("\nScene start offsets (char index):")
    for s, off in zip(scenes, offsets):
        print(f"  {s['key']:<11} @ char {off}")


def main():
    args = sys.argv[1:]
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()

    if "--dry-run" in args:
        dry_run()
        return
    if not api_key:
        sys.exit("Set ELEVENLABS_API_KEY (export ELEVENLABS_API_KEY=sk_...). "
                 "Use --dry-run to preview the script without a key.")
    if "--list-voices" in args:
        list_voices(api_key)
        return

    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or DEFAULT_VOICE_ID
    model = os.environ.get("ELEVENLABS_MODEL", "").strip() or DEFAULT_MODEL
    render(api_key, voice_id, model)


if __name__ == "__main__":
    main()
