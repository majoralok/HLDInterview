# Python interview patterns

Run from the repository root with Python 3.11 or newer. No pip packages are needed.

```python
from examples.python.patterns import page_after, rollout_enabled

events = [(100, "a"), (100, "b"), (101, "c")]
first = page_after(events, cursor=None, limit=2)
second = page_after(events, cursor=first[-1], limit=2)
assert first + second == events

assert rollout_enabled("new-checkout", "user-42", percentage=100)
```

Every pattern isolates one design decision. A token bucket is a single-thread model, a cursor assumes an ordered unique key, rank fusion assumes authorized candidates, and the ledger is an in-memory transfer model. Discuss the database transaction, durability, failure, and isolation requirements before treating any model as a service.

Run `python -m unittest discover -s tests -v` from the repository root to exercise the models, shared browser rules, and standalone Worker. The full suite also requires Node. After editing a pattern, run `python scripts/build_worker.py` to refresh the examples displayed in both app variants.
