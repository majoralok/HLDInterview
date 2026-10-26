"""Exercise the production graph/review modules with deterministic, offline fixtures."""
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
PRELUDE = '''
import * as arch from "./public/architecture-core.js";
import * as core from "./public/practice-core.js";
import { groundReview } from "./lib/review-contract.js";
const node = (id, type="service", capacity=10000, latency=10) => ({id,type,label:id,notes:"",x:20,y:20,capacity,latency,replicas:1});
const edge = (source,target,async=false,fraction=1) => ({id:source+"-"+target,source,target,protocol:"HTTP",async,fraction});
const graph = (nodes,edges,traffic=1000) => ({version:1,nodes,edges,traffic});
'''


def evaluate(expression):
    result = subprocess.run(['node', '--input-type=module'], input=PRELUDE + '\nconsole.log(JSON.stringify(' + expression + '));',
                            capture_output=True, text=True, cwd=ROOT, check=True)
    return json.loads(result.stdout)


class ArchitectureTests(unittest.TestCase):
    def test_orphans_do_not_receive_traffic_or_reduce_entry_load(self):
        result = evaluate('arch.analyzeDiagram(graph([node("client","client"),node("api"),node("orphan","cache")],[edge("client","api")]))')
        self.assertEqual(result['disconnected'], ['orphan'])
        self.assertEqual([m['qps'] for m in result['metrics']], [1000, 1000])

    def test_load_balancer_splits_and_services_fan_out(self):
        result = evaluate('''arch.analyzeDiagram(graph([node("c","client"),node("lb","balancer"),node("a"),node("b"),node("db","database")],
          [edge("c","lb"),edge("lb","a"),edge("lb","b"),edge("a","db"),edge("b","db")]))''')
        qps = {m['id']: m['qps'] for m in result['metrics']}
        self.assertEqual(qps, {'c': 1000, 'lb': 1000, 'a': 500, 'b': 500, 'db': 1000})

    def test_cache_miss_fraction_and_async_latency(self):
        result = evaluate('''arch.analyzeDiagram(graph([node("c","client",10000,0),node("cache","cache",10000,1),node("db","database",10000,8),node("worker","worker",10000,900)],
          [edge("c","cache"),edge("cache","db",false,0.1),edge("c","worker",true)]))''')
        self.assertEqual(next(m['qps'] for m in result['metrics'] if m['id'] == 'db'), 100)
        self.assertEqual(result['latency'], 9)

    def test_overload_caps_delivered_work_and_failure_stops_forwarding(self):
        result = evaluate('''(() => { const g=graph([node("c","client"),node("api","service",200),node("db","database")],[edge("c","api"),edge("api","db")]);
          return {normal:arch.analyzeDiagram(g),failed:arch.analyzeDiagram(g,"api")}; })()''')
        self.assertEqual(result['normal']['bottlenecks'], ['api'])
        self.assertEqual(next(m['qps'] for m in result['normal']['metrics'] if m['id'] == 'db'), 200)
        self.assertEqual(next(m['qps'] for m in result['failed']['metrics'] if m['id'] == 'db'), 0)

    def test_cycles_are_not_reported_as_healthy(self):
        result = evaluate('arch.analyzeDiagram(graph([node("c","client"),node("a"),node("b")],[edge("c","a"),edge("a","b"),edge("b","a")]))')
        self.assertTrue(result['cyclic'])
        self.assertIsNone(result['latency'])
        self.assertEqual(result['metrics'], [])

    def test_validation_rejects_dangling_duplicates_and_nonfinite_values(self):
        result = evaluate('''(() => { const n=node("a"); const invalid=[graph([n,n],[]),graph([n],[edge("a","missing")]),
          graph([n,node("b")],[edge("a","b"),{...edge("a","b"),id:"other"}]),graph([{...n,x:Infinity}],[]),graph([{...n,replicas:1.2}],[]),graph([n],[],NaN)];
          return invalid.every(g=>{try{arch.parseDiagram(g);return false;}catch{return true;}}); })()''')
        self.assertTrue(result)

    def test_backup_roundtrip_preserves_graph_and_filters_unknown_fields(self):
        result = evaluate('''core.parseImport(JSON.stringify({version:1,progress:{chat:{status:"in_progress",bookmarked:false,attempts:0,
          diagram:graph([{...node("a"),injected:"ignore"}],[])}}}),["chat"])''')
        self.assertEqual(result['chat']['diagram']['nodes'][0]['id'], 'a')
        self.assertNotIn('injected', result['chat']['diagram']['nodes'][0])

    def test_grounding_removes_invented_quotes_and_sorts_severity(self):
        result = evaluate('''groundReview({score:60,summary:"Test",strengths:["A"],improvements:["B"],followUp:"Why?",findings:[
          {severity:"low",dimension:"cost",title:"A",evidence:"ONE   DATABASE",recommendation:"Test backup"},
          {severity:"high",dimension:"security",title:"B",evidence:"general",recommendation:"Specify authz"},
          {severity:"critical",dimension:"reliability",title:"Invented",evidence:"no backups ever",recommendation:"Fix"},
          {severity:"low",dimension:"cost",title:"Empty",evidence:"",recommendation:"Fix"}
          ]}, "One database stores the links.")''')
        self.assertEqual([f['title'] for f in result['findings']], ['B', 'A'])

    def test_auto_generated_diagram_labels_do_not_earn_coverage_credit(self):
        result = evaluate('''core.localAssessment("",{interviewerPush:"Why?"},"",graph([node("c","client"),node("db","database")],[edge("c","db")]))''')
        self.assertEqual(result['score'], 0)
        self.assertTrue(any('reachable' in s for s in result['strengths']))

    def test_capacity_units_and_phase_boundaries(self):
        result = evaluate('({estimate:arch.estimateCapacity(86400000,3,500,30),phases:[arch.phaseAt(0,2700),arch.phaseAt(297,2700),arch.phaseAt(2700,2700)]})')
        self.assertEqual(result['estimate'], {'averageQps': 1000, 'peakQps': 3000, 'storageGB': 1296, 'bandwidthMbps': 12})
        self.assertEqual(result['phases'], [0, 1, 4])
