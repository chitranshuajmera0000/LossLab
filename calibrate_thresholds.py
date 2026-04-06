"""
LossLab — calibrate_thresholds.py
Run this LOCALLY after downloading all 6 JSON files.

Purpose: verify that the win/stretch thresholds in missions.js
are achievable with the real data. If the best real config
only hits 79% but winFn requires 82%, you need to lower the threshold.

Usage:
  python calibrate_thresholds.py

Place all *_curves.json files in the same directory as this script.
"""

import json
import os

FILES = {
    'exploder':        'exploder_curves.json',
    'flatliner':       'flatliner_curves.json',
    'memorizer':       'memorizer_curves.json',
    'slowlearner':     'slowlearner_curves.json',
    'symmetrybreaker': 'symmetrybreaker_curves.json',
    'batcheffect':     'batcheffect_curves.json',
}

# Current thresholds from missions.js
THRESHOLDS = {
    'exploder':        {'win_acc': 0.82, 'stretch_acc': 0.90},
    'flatliner':       {'win_acc': 0.80, 'stretch_acc': 0.88},
    'memorizer':       {'win_acc': 0.74, 'win_gap': 0.12, 'stretch_acc': 0.82, 'stretch_gap': 0.04},
    'slowlearner':     {'win_acc': 0.76, 'stretch_acc': 0.84},
    'symmetrybreaker': {'win_acc': 0.76, 'win_gap': 0.10, 'stretch_acc': 0.84, 'stretch_gap': 0.05},
    'batcheffect':     {'win_acc': 0.80, 'win_gap': 0.12, 'stretch_acc': 0.87},
}

print("=" * 70)
print("LOSSLAB THRESHOLD CALIBRATION REPORT")
print("=" * 70)
print()

all_ok = True

for mid, fname in FILES.items():
    if not os.path.exists(fname):
        print(f"  {mid}: FILE NOT FOUND — {fname}")
        print()
        continue

    with open(fname) as f:
        data = json.load(f)

    t = THRESHOLDS[mid]
    n = len(data)

    # Compute stats across all configs
    accs   = [r['ac'][-1] for r in data.values()]
    gaps   = [r['vl'][-1] - r['tl'][-1] for r in data.values()]
    losses = [max(r['tl']) for r in data.values()]

    best_acc  = max(accs)
    best_gap  = min(gaps)
    med_acc   = sorted(accs)[n // 2]

    # Count wins
    def is_win(r):
        acc = r['ac'][-1]
        gap = r['vl'][-1] - r['tl'][-1]
        if mid in ('memorizer', 'symmetrybreaker'):
            return acc > t['win_acc'] and gap < t['win_gap']
        if mid == 'batcheffect':
            return acc > t['win_acc'] and gap < t['win_gap']
        return acc > t['win_acc']

    def is_stretch(r):
        acc = r['ac'][-1]
        gap = r['vl'][-1] - r['tl'][-1]
        if mid in ('memorizer', 'symmetrybreaker'):
            return acc > t['stretch_acc'] and gap < t['stretch_gap']
        return acc > t['stretch_acc']

    n_win     = sum(1 for r in data.values() if is_win(r))
    n_stretch = sum(1 for r in data.values() if is_stretch(r))
    n_diverge = sum(1 for l in losses if l > 4.0)

    print(f"Mission: {mid}")
    print(f"  Configs: {n}")
    print(f"  Best val accuracy:   {best_acc:.3f}  (need > {t['win_acc']} to win)")
    print(f"  Median val accuracy: {med_acc:.3f}")
    print(f"  Best gap achieved:   {best_gap:.3f}")
    print(f"  Diverged configs:    {n_diverge} ({100*n_diverge/n:.1f}%)")
    print(f"  Win condition met:   {n_win}/{n} ({100*n_win/n:.1f}%)")
    print(f"  Stretch met:         {n_stretch}/{n} ({100*n_stretch/n:.1f}%)")

    # Threshold recommendations
    problems = []

    if n_win == 0:
        rec_win = best_acc * 0.95
        problems.append(
            f"  ⚠ NO CONFIGS WIN! Best acc={best_acc:.3f}. "
            f"Recommend lowering win threshold to {rec_win:.2f}"
        )
        all_ok = False
    elif n_win < n * 0.05:
        problems.append(
            f"  ⚠ Only {n_win} configs win (<5%). "
            f"Consider lowering win threshold slightly."
        )

    if n_stretch == 0 and n_win > 0:
        rec_stretch = best_acc * 0.97
        problems.append(
            f"  ⚠ No configs hit stretch. Best acc={best_acc:.3f}. "
            f"Recommend lowering stretch threshold to {rec_stretch:.2f}"
        )

    if n_win > n * 0.5:
        problems.append(
            f"  ⚠ Too easy — {n_win}/{n} configs win. "
            f"Consider raising win threshold."
        )

    if problems:
        for p in problems:
            print(p)
    else:
        print(f"  ✓ Thresholds look good")

    print()

print("=" * 70)
if all_ok:
    print("✓ All missions calibrated. Thresholds in missions.js are valid.")
else:
    print("⚠ Some thresholds need adjustment. See recommendations above.")
    print("  Update winFn thresholds in src/missions/missions.js accordingly.")
print("=" * 70)
