import json
from pathlib import Path
import unittest

from examples.python.patterns import (
    Ledger, TokenBucket, chunk_digest, estimate_capacity, page_after,
    reciprocal_rank_fusion, rollout_enabled,
)
from scripts.build_worker import learning_material

ROOT = Path(__file__).resolve().parents[1]


class PatternTests(unittest.TestCase):
    def test_capacity_units_and_replication(self):
        result = estimate_capacity(86_400, 3, 100, 2, 3)
        self.assertEqual(result["average_rps"], 1)
        self.assertEqual(result["peak_rps"], 3)
        self.assertEqual(result["storage_bytes"], 51_840_000)
        with self.assertRaises(ValueError):
            estimate_capacity(100, 0, 100, 1)

    def test_token_bucket_refill_burst_and_clock_rollback(self):
        clock = [100.0]
        bucket = TokenBucket(2, 1, lambda: clock[0])
        self.assertTrue(bucket.allow(2))
        self.assertFalse(bucket.allow())
        clock[0] += 0.5
        self.assertFalse(bucket.allow())
        clock[0] += 0.5
        self.assertTrue(bucket.allow())
        clock[0] = 99
        self.assertFalse(bucket.allow())
        clock[0] = 101
        self.assertFalse(bucket.allow())
        clock[0] = 1000
        self.assertTrue(bucket.allow(2))
        self.assertFalse(bucket.allow())

    def test_rollouts_are_stable_and_nested(self):
        self.assertFalse(rollout_enabled("flag", "alice", 0))
        self.assertTrue(rollout_enabled("flag", "alice", 100))
        small = {str(i) for i in range(1000) if rollout_enabled("flag", str(i), 10)}
        large = {str(i) for i in range(1000) if rollout_enabled("flag", str(i), 50)}
        self.assertLess(small, large)
        self.assertEqual(small, {str(i) for i in range(1000) if rollout_enabled("flag", str(i), 10)})
        with self.assertRaises(ValueError):
            rollout_enabled("flag", "alice", 101)

    def test_cursor_tie_breaker_avoids_duplicates(self):
        rows = [(5, "c"), (5, "a"), (6, "d"), (5, "b")]
        first = page_after(rows, None, 2)
        second = page_after(rows, first[-1], 2)
        self.assertEqual(first + second, sorted(rows))
        self.assertEqual(page_after(rows, second[-1]), [])

    def test_content_hash_changes_with_content(self):
        self.assertEqual(chunk_digest(b"hello"), chunk_digest(b"hello"))
        self.assertNotEqual(chunk_digest(b"hello"), chunk_digest(b"Hello"))

    def test_rank_fusion_deduplicates_each_source(self):
        self.assertEqual(reciprocal_rank_fusion([["a", "a", "b"], ["b"]])[0], "b")
        self.assertEqual(reciprocal_rank_fusion([]), [])

    def test_transfer_retry_and_conflicting_idempotency_key(self):
        ledger = Ledger({"alice": 1000, "bob": 0})
        ledger.transfer("payment-1", "alice", "bob", 300)
        ledger.transfer("payment-1", "alice", "bob", 300)
        self.assertEqual((ledger.balance("alice"), ledger.balance("bob")), (700, 300))
        with self.assertRaises(ValueError):
            ledger.transfer("payment-1", "alice", "bob", 400)
        with self.assertRaises(ValueError):
            ledger.transfer("payment-2", "alice", "bob", 800)
        self.assertEqual(ledger.balance("alice") + ledger.balance("bob"), 1000)

    def test_every_lesson_is_current_and_runs_independently(self):
        lessons = learning_material()
        self.assertEqual(lessons, json.loads((ROOT / "data/python-lessons.json").read_text(encoding="utf-8")))
        problems = json.loads((ROOT / "data/problems.json").read_text(encoding="utf-8"))
        self.assertEqual(set(lessons), {problem["id"] for problem in problems})
        self.assertEqual(len(problems), 30)
        for lesson in lessons.values():
            namespace = {}
            exec(compile(lesson["code"], "<python lesson>", "exec"), namespace)
            self.assertIn(lesson["pattern"], namespace)
