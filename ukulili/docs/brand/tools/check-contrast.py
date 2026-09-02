#!/usr/bin/env python3
"""Ukulili marka paleti WCAG kontrast denetleyicisi.

colors.json icinde bildirilen her metin/zemin ciftini WCAG 2.1 AA'ya (normal
metin icin 4.5:1) gore dogrular. Palet degistiginde CI'da calisir.

Kullanim:
    python3 docs/brand/tools/check-contrast.py
    python3 docs/brand/tools/check-contrast.py --json    # makine okunur cikti

Cikis kodu: hata varsa 1, hepsi gecerse 0.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AA_NORMAL = 4.5
AA_LARGE = 3.0

TOKENS = Path(__file__).resolve().parent.parent / "tokens" / "colors.json"


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    channels = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
              for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def collect_pairs(tokens: dict) -> list[tuple[str, str, str]]:
    """(etiket, on_plan, arka_plan) uclulerini toplar."""
    pairs: list[tuple[str, str, str]] = []

    # Marka rampalari: dolgu uzeri metin + acik zeminde metin tonu
    for name, ramp in tokens["brand"].items():
        if ramp.get("role") == "decorative-only":
            continue
        fill_tone = ramp.get("fillTone")
        if fill_tone and ramp.get("onFill"):
            pairs.append((f"{name}: onFill / {fill_tone} dolgu",
                          ramp["onFill"], ramp[fill_tone]))
        text_tone = ramp.get("textOnLight")
        if text_tone:
            pairs.append((f"{name}: {text_tone} metin / beyaz",
                          ramp[text_tone], "#FFFFFF"))
        container_text = ramp.get("textOnOwnContainer")
        container = ramp.get("50") or ramp.get("100")
        if container_text and container:
            pairs.append((f"{name}: {container_text} metin / kendi kapsayicisi",
                          ramp[container_text], container))

    # Zorluk seviyeleri
    for level, cfg in tokens["difficulty"].items():
        if not isinstance(cfg, dict):
            continue
        pairs.append((f"zorluk/{level}: onFill / fill", cfg["onFill"], cfg["fill"]))
        pairs.append((f"zorluk/{level}: onContainer / container",
                      cfg["onContainer"], cfg["container"]))

    # Anlam renkleri
    for role, cfg in tokens["semantic"].items():
        if not isinstance(cfg, dict):
            continue
        pairs.append((f"anlam/{role}: onFill / fill", cfg["onFill"], cfg["fill"]))
        pairs.append((f"anlam/{role}: metin / beyaz", cfg["text"], "#FFFFFF"))

    # Temalar
    for theme, cfg in tokens["theme"].items():
        if not isinstance(cfg, dict):
            continue
        bg, surface = cfg["background"], cfg["surface"]
        pairs += [
            (f"{theme}: onSurface / surface", cfg["onSurface"], surface),
            (f"{theme}: onSurfaceVariant / surface", cfg["onSurfaceVariant"], surface),
            (f"{theme}: onPrimary / primary", cfg["onPrimary"], cfg["primary"]),
            (f"{theme}: onSecondary / secondary", cfg["onSecondary"], cfg["secondary"]),
            (f"{theme}: onAccent / accent", cfg["onAccent"], cfg["accent"]),
            (f"{theme}: primaryText / background", cfg["primaryText"], bg),
            (f"{theme}: secondaryText / background", cfg["secondaryText"], bg),
            (f"{theme}: accentText / background", cfg["accentText"], bg),
            (f"{theme}: onPrimaryContainer / primaryContainer",
             cfg["onPrimaryContainer"], cfg["primaryContainer"]),
            (f"{theme}: onSecondaryContainer / secondaryContainer",
             cfg["onSecondaryContainer"], cfg["secondaryContainer"]),
        ]
    return pairs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="JSON cikti ver")
    parser.add_argument("--tokens", type=Path, default=TOKENS)
    args = parser.parse_args()

    tokens = json.loads(args.tokens.read_text(encoding="utf-8"))
    results = []
    for label, fg, bg in collect_pairs(tokens):
        ratio = contrast(fg, bg)
        if ratio >= AA_NORMAL:
            status = "PASS"
        elif ratio >= AA_LARGE:
            status = "LARGE-ONLY"
        else:
            status = "FAIL"
        results.append({"pair": label, "fg": fg, "bg": bg,
                        "ratio": round(ratio, 2), "status": status})

    failures = [r for r in results if r["status"] != "PASS"]

    if args.json:
        print(json.dumps({"results": results, "failures": len(failures)},
                         ensure_ascii=False, indent=2))
    else:
        width = max(len(r["pair"]) for r in results)
        for r in results:
            mark = {"PASS": "OK  ", "LARGE-ONLY": "BUYUK", "FAIL": "HATA"}[r["status"]]
            print(f"{mark} {r['pair']:<{width}}  {r['ratio']:5.2f}:1  "
                  f"{r['fg']} / {r['bg']}")
        print()
        print(f"{len(results) - len(failures)}/{len(results)} cift WCAG AA (4.5:1) gecti.")
        if failures:
            print(f"\n{len(failures)} cift basarisiz:")
            for r in failures:
                print(f"  - {r['pair']}: {r['ratio']}:1")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
