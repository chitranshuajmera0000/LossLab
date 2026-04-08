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
import math

FILES = {
    'exploder':        'exploder_curves.json',
    'flatliner':       'flatliner_curves.json',
    'memorizer':       'memorizer_curves.json',
    'slowlearner':     'slowlearner_curves.json',
    'symmetrybreaker': 'symmetrybreaker_curves.json',
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


def last_number(seq):
    """Return the last numeric value in seq, or None if unavailable."""
    if not isinstance(seq, list):
        return None
    for v in reversed(seq):
        if isinstance(v, (int, float)):
            return v
    return None


def max_number(seq):
    """Return max numeric value in seq, or None if unavailable."""
    if not isinstance(seq, list):
        return None
    nums = [v for v in seq if isinstance(v, (int, float))]
    if not nums:
        return None
    return max(nums)


def percentile(sorted_vals, p):
    """Linear-interpolated percentile for a pre-sorted list."""
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)

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
    accs = []
    gaps = []
    losses = []

    for r in data.values():
        acc = last_number(r.get('ac'))
        vl = last_number(r.get('vl'))
        tl = last_number(r.get('tl'))
        peak_tl = max_number(r.get('tl'))

        if acc is not None:
            accs.append(acc)
        if vl is not None and tl is not None:
            gaps.append(vl - tl)
        if peak_tl is not None:
            losses.append(peak_tl)

    if not accs:
        print(f"Mission: {mid}")
        print(f"  Configs: {n}")
        print("  ⚠ No valid numeric accuracy values found; skipping mission analysis.")
        print()
        all_ok = False
        continue

    best_acc  = max(accs)
    best_gap  = min(gaps) if gaps else float('nan')
    med_acc   = sorted(accs)[len(accs) // 2]
    sorted_accs = sorted(accs)
    rec_win_q = percentile(sorted_accs, 0.90)   # ~top 10% wins
    rec_stretch_q = percentile(sorted_accs, 0.97)  # ~top 3% stretch

    # Count wins
    def is_win(r):
        acc = last_number(r.get('ac'))
        vl = last_number(r.get('vl'))
        tl = last_number(r.get('tl'))
        gap = (vl - tl) if vl is not None and tl is not None else None
        peak_tl = max_number(r.get('tl'))
        diverged = peak_tl is not None and peak_tl > 4.0
        if mid == 'exploder':
            if acc is None:
                return False
            return acc > t['win_acc'] and not diverged
        if mid in ('memorizer', 'symmetrybreaker'):
            if acc is None or gap is None:
                return False
            return acc > t['win_acc'] and gap < t['win_gap']
        if mid == 'batcheffect':
            if acc is None or gap is None:
                return False
            return acc > t['win_acc'] and gap < t['win_gap']
        if acc is None:
            return False
        return acc > t['win_acc']

    def is_stretch(r):
        acc = last_number(r.get('ac'))
        vl = last_number(r.get('vl'))
        tl = last_number(r.get('tl'))
        gap = (vl - tl) if vl is not None and tl is not None else None
        peak_tl = max_number(r.get('tl'))
        diverged = peak_tl is not None and peak_tl > 4.0
        if mid == 'exploder':
            if acc is None:
                return False
            return acc > t['stretch_acc'] and not diverged
        if mid in ('memorizer', 'symmetrybreaker'):
            if acc is None or gap is None:
                return False
            return acc > t['stretch_acc'] and gap < t['stretch_gap']
        if acc is None:
            return False
        return acc > t['stretch_acc']

    n_win     = sum(1 for r in data.values() if is_win(r))
    n_stretch = sum(1 for r in data.values() if is_stretch(r))
    n_diverge = sum(1 for l in losses if l > 4.0)

    print(f"Mission: {mid}")
    print(f"  Configs: {n}")
    print(f"  Best val accuracy:   {best_acc:.3f}  (need > {t['win_acc']} to win)")
    print(f"  Median val accuracy: {med_acc:.3f}")
    if gaps:
        print(f"  Best gap achieved:   {best_gap:.3f}")
    else:
        print("  Best gap achieved:   N/A (missing val/train loss values)")
    print(f"  Diverged configs:    {n_diverge} ({100*n_diverge/n:.1f}%)")
    print(f"  Win condition met:   {n_win}/{n} ({100*n_win/n:.1f}%)")
    print(f"  Stretch met:         {n_stretch}/{n} ({100*n_stretch/n:.1f}%)")
    print(f"  Suggested win_acc:   ~{rec_win_q:.3f} (targets ~10% wins)")
    print(f"  Suggested stretch:   ~{rec_stretch_q:.3f} (targets ~3% wins)")

    if mid == 'slowlearner':
        print("  Note: slowlearner real winFn also needs >=3 optimizers explored across runs.")

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