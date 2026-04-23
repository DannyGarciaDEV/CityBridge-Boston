#!/usr/bin/env python3
"""
Pull the Boston resources table from Hugging Face and write data/resources.json
for the kiosk and MCP server (meta is merged from data/resources-meta.json).

Uses Hugging Face Datasets as requested:

    from datasets import load_dataset
    ds = load_dataset("drixo/resources-boston")

If that slug is not yet wired on the Hub, falls back to loading the published
JSON file as a dataset.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "resources.json"
META_PATH = ROOT / "data" / "resources-meta.json"
HF_JSON = (
    "https://huggingface.co/datasets/drixo/resources-boston/"
    "resolve/main/resources.json"
)


def load_meta() -> dict:
    if not META_PATH.is_file():
        print(f"Missing {META_PATH}", file=sys.stderr)
        sys.exit(1)
    raw = json.loads(META_PATH.read_text(encoding="utf-8"))
    if "disclaimer" in raw and "meta" not in raw:
        return raw
    if "meta" in raw:
        return raw["meta"]
    print(f"Unexpected shape in {META_PATH}", file=sys.stderr)
    sys.exit(1)


def load_table():
    from datasets import load_dataset

    last_err: Exception | None = None
    for factory in (
        lambda: load_dataset("drixo/resources-boston"),
        lambda: load_dataset("json", data_files=HF_JSON),
    ):
        try:
            return factory()
        except Exception as e:  # noqa: BLE001 — try next loader
            last_err = e
    assert last_err is not None
    raise last_err


def table_to_resource_dicts(ds) -> list[dict]:
    split = "train" if "train" in ds else next(iter(ds))
    table = ds[split]
    out: list[dict] = []
    for i in range(len(table)):
        row = table[i]
        out.append(dict(row))
    return out


def main() -> None:
    meta = load_meta()
    ds = load_table()
    raw_rows = table_to_resource_dicts(ds)

    # Hub file may be either a bare list of resources or a single row holding the bundle.
    if (
        len(raw_rows) == 1
        and "resources" in raw_rows[0]
        and isinstance(raw_rows[0]["resources"], list)
    ):
        resources = raw_rows[0]["resources"]
        if "meta" in raw_rows[0] and isinstance(raw_rows[0]["meta"], dict):
            meta = raw_rows[0]["meta"]
    else:
        resources = raw_rows

    bundle = {"meta": meta, "resources": resources}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT} ({len(resources)} resources)")


if __name__ == "__main__":
    main()
