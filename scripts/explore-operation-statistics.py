"""Exploratory order-level statistics; does not establish a causal effect.

Usage: python scripts/explore-operation-statistics.py INPUT FIRST_DAY SECOND_DAY
Requires the project's Node.js and analysis-only NumPy / SciPy >= 1.11.
Input is the same private minimal schema as analyze-operation-days.mjs.
"""
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import scipy
from scipy import stats


def explore(path, first_day, second_day):
    # Reuse strict minimal-schema/date validation; no raw records in output.
    script = Path(__file__).with_name('analyze-operation-days.mjs')
    validated = subprocess.run(
        ['node', str(script), str(path), first_day, second_day],
        capture_output=True, text=True, encoding='utf-8', check=False,
    )
    if validated.returncode:
        raise ValueError('Input failed minimal-schema validation')
    rows = json.loads(Path(path).read_text(encoding='utf-8'))['records']
    groups = {first_day: [], second_day: []}
    korea = timezone(timedelta(hours=9))
    for row in rows:
        start = datetime.fromisoformat(row['createdAt'].replace('Z', '+00:00'))
        day = start.astimezone(korea).date().isoformat()
        if day not in groups or row['completedAt'] is None:
            continue
        end = datetime.fromisoformat(row['completedAt'].replace('Z', '+00:00'))
        duration = (end - start).total_seconds() / 60
        if duration >= 0:
            groups[day].append((start.astimezone(korea).hour, row['quantity'], duration))

    def describe(records):
        return {'count': len(records), 'meanMinutes': float(np.mean([r[2] for r in records])) if records else None}

    def tests(first, second):
        if min(len(first), len(second)) < 2:
            return {'status': 'insufficient', 'counts': [len(first), len(second)]}
        a, b = np.asarray(first), np.asarray(second)
        welch = stats.ttest_ind(a, b, equal_var=False, alternative='two-sided')
        if not np.isfinite(welch.statistic) or not np.isfinite(welch.pvalue):
            return {'status': 'degenerate', 'counts': [len(a), len(b)]}
        interval = welch.confidence_interval(.95)
        rank = stats.mannwhitneyu(a, b, alternative='two-sided', method='asymptotic', use_continuity=True)
        return {
            'status': 'exploratory-independent-order-assumption',
            'counts': [len(a), len(b)], 'meanMinutes': [float(a.mean()), float(b.mean())],
            'sampleSDMinutes': [float(a.std(ddof=1)), float(b.std(ddof=1))],
            'meanDifferenceMinutes': float(a.mean() - b.mean()),
            'welchT': float(welch.statistic), 'welchDF': float(welch.df),
            'welchTwoSidedP': float(welch.pvalue),
            'independentOrderMeanDifference95CI': [float(interval.low), float(interval.high)],
            'mannWhitneyU': float(rank.statistic), 'mannWhitneyTwoSidedP': float(rank.pvalue),
        }

    a, b = groups[first_day], groups[second_day]
    return {
        'interpretation': 'Exploratory only. Orders share a daily queue; there are only two observed days. No robust day-level causal p-value is estimated. The reported order-level CI can be too narrow under dependence.',
        'versions': {'numpy': np.__version__, 'scipy': scipy.__version__},
        'descriptive': json.loads(validated.stdout),
        'allOrderExploration': tests([r[2] for r in a], [r[2] for r in b]),
        'window15SecondsTo120MinutesExploration': tests([r[2] for r in a if .25 <= r[2] <= 120], [r[2] for r in b if .25 <= r[2] <= 120]),
        'singleItemDescriptive': [describe([r for r in a if r[1] == 1]), describe([r for r in b if r[1] == 1])],
        'commonReceiptHoursDescriptive': [
            {'hourKST': hour, 'days': [describe([r for r in a if r[0] == hour]), describe([r for r in b if r[0] == hour])]}
            for hour in sorted(set(r[0] for r in a) & set(r[0] for r in b))
        ],
    }


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit('Usage: python scripts/explore-operation-statistics.py INPUT FIRST_DAY SECOND_DAY')
    try:
        print(json.dumps(explore(*sys.argv[1:]), indent=2, allow_nan=False))
    except (ValueError, OSError, subprocess.SubprocessError):
        sys.exit('Unable to analyze the minimal input; no raw records were printed')
