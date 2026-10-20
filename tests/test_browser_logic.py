"""Python test runner exercising the actual browser module in Node, without npm."""

import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


def evaluate(expression):
    program = 'import * as core from "./public/practice-core.js";\n'
    program += "console.log(JSON.stringify(" + expression + "));"
    result = subprocess.run(["node", "--input-type=module"], input=program, text=True,
                            capture_output=True, cwd=ROOT, check=True)
    return json.loads(result.stdout)


class BrowserLogicTests(unittest.TestCase):
    def test_template_cannot_be_scored_as_an_answer(self):
        result = evaluate('''(() => {
            const template = "1. SCOPE & ASSUMPTIONS\\n- Write your scope and API design here.";
            try { core.localAssessment(template, {interviewerPush:"Why?"}, template); return false; }
            catch { return true; }
        })()''')
        self.assertTrue(result)

    def test_original_answer_earns_only_detected_feedback(self):
        result = evaluate('''core.localAssessment(
            "We expect 1000 requests per second. POST /links accepts a URL and idempotency key. " +
            "Store aliases in a database with a unique index. Cache popular redirects because reads dominate. " +
            "On a timeout retry using the same key. Check authorization for every private link.",
            {interviewerPush:"What if the cache fails?"}, "")''')
        self.assertGreater(result["score"], 60)
        self.assertIn("correctness", result["summary"])
        self.assertEqual(len(result["strengths"]), 6)

    def test_backup_roundtrip_filters_unknown_ids_and_fields(self):
        result = evaluate('''core.parseImport(JSON.stringify({version:1,progress:{
            chat:{status:"done",bookmarked:true,attempts:2,score:85,draft:"hello",injected:"ignore"},
            unknown:{status:"done"}
        }}), ["chat"])''')
        self.assertEqual(result, {"chat": {"status": "done", "bookmarked": True, "attempts": 2, "score": 85, "draft": "hello"}})

    def test_corrupt_backups_are_rejected(self):
        result = evaluate('''(() => {
            const valid = {status:"todo",bookmarked:false,attempts:0};
            const items = [null, [], {chat:null}, {chat:{...valid,score:101}},
                {chat:{...valid,attempts:-1}}, {chat:{...valid,draft:"a".repeat(25001)}}];
            return items.every(value => { try { core.parseProgress(value,["chat"]); return false; } catch { return true; } });
        })()''')
        self.assertTrue(result)

    def test_feedback_requires_complete_valid_fields(self):
        result = evaluate('''(() => {
            const valid = {score:75,summary:"Good",strengths:["a"],improvements:["b"],followUp:"Why?"};
            return [core.isFeedback(valid), core.isFeedback({...valid,score:101}),
                core.isFeedback({...valid,strengths:[1]}), core.isFeedback({...valid,followUp:null})];
        })()''')
        self.assertEqual(result, [True, False, False, False])
