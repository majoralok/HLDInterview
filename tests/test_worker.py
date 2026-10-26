"""HTTP integration checks against the built Worker, with paid AI calls disabled."""

import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from scripts.build_worker import build

ROOT = Path(__file__).resolve().parents[1]


class WorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build()
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}'
        environment = {**os.environ, 'ARCHITECT_LAB_PORT': str(port), 'OPENAI_API_KEY': ''}
        cls.log = tempfile.TemporaryFile()
        cls.addClassCleanup(cls.log.close)
        cls.process = subprocess.Popen(['node', 'scripts/serve-worker.mjs'], cwd=ROOT,
                                       env=environment, stdout=cls.log, stderr=cls.log)
        cls.addClassCleanup(cls.stop_server)
        for _ in range(100):
            try:
                with urlopen(cls.base + '/api/health', timeout=1):
                    return
            except (URLError, TimeoutError):
                if cls.process.poll() is not None:
                    cls.log.seek(0)
                    raise RuntimeError(cls.log.read().decode())
                time.sleep(0.05)
        raise RuntimeError('Local Worker did not start')

    @classmethod
    def stop_server(cls):
        cls.process.terminate()
        try:
            cls.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.process.kill()
            cls.process.wait()

    def request(self, path, body=None, method=None, headers=None):
        request = Request(self.base + path, data=body, method=method,
                          headers=headers or {'Content-Type': 'application/json'})
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read()

    def review(self, value, headers=None):
        return self.request('/api/coach', json.dumps(value).encode(), headers=headers)

    def test_routes_curriculum_and_python_lessons(self):
        status, headers, home = self.request('/')
        self.assertEqual(status, 200)
        self.assertIn(b'ScaleSketch', home)
        self.assertIn("script-src 'self'", headers['Content-Security-Policy'])
        _, _, body = self.request('/api/problems')
        problems = json.loads(body)
        self.assertEqual(len(problems), 30)
        self.assertEqual(len({problem['id'] for problem in problems}), 30)
        _, _, lessons = self.request('/api/lessons')
        self.assertEqual(set(json.loads(lessons)), {problem['id'] for problem in problems})
        for route in ['/app.js', '/app.css', '/practice-core.js', '/architecture-core.js', '/architecture-workbench.js', '/architecture-workbench.css']:
            self.assertEqual(self.request(route)[0], 200)

    def test_missing_key_returns_safe_fallback(self):
        status, headers, body = self.review({'problem': {'id': 'short-links'}, 'answer': 'A' * 140})
        self.assertEqual(status, 503)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertIn(b'local rubric', body)

    def test_cross_origin_and_malformed_origins(self):
        for origin in ['https://unrelated.test', 'null', 'not a URL']:
            status, _, _ = self.review({'problem': {'id': 'short-links'}, 'answer': 'A' * 140},
                                       {'Content-Type': 'application/json', 'Origin': origin})
            self.assertEqual(status, 403)

    def test_invalid_payloads_and_body_limit(self):
        for value in [None, [], {}, {'problem': {'id': 'unknown'}, 'answer': 'A' * 140},
                      {'problem': {'id': 'chat'}, 'answer': ' ' * 140},
                      {'problem': {'id': 'chat'}, 'answer': 'A' * 25001}]:
            self.assertEqual(self.review(value)[0], 400)
        self.assertEqual(self.request('/api/coach', b'{')[0], 400)
        self.assertEqual(self.request('/api/coach', b'A' * 128001)[0], 413)
        self.assertEqual(self.request('/api/coach', b'{}', headers={'Content-Type': 'text/plain'})[0], 415)

    def test_methods_head_and_not_found(self):
        self.assertEqual(self.request('/api/health', b'{}')[0], 405)
        self.assertEqual(self.request('/api/coach')[0], 405)
        self.assertEqual(self.request('/missing')[0], 404)
        for path in ['/', '/api/health', '/api/problems', '/app.js']:
            status, _, body = self.request(path, method='HEAD')
            self.assertEqual(status, 200)
            self.assertEqual(body, b'')

    def test_trusted_brief_and_mocked_review_validation(self):
        # Exercise the real Worker with a local upstream stub; never contact OpenAI.
        program = '''
import worker from "./dist/server/index.js";
let sent;
let feedback = {score:82,summary:"Review",strengths:["Clear API"],improvements:["Add recovery"],followUp:"Why?"};
globalThis.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return Response.json({output_text:JSON.stringify(feedback)});
};
const request = () => new Request("https://lab.test/api/coach", {
    method:"POST", headers:{"content-type":"application/json"},
    body:JSON.stringify({problem:{id:"chat",title:"Untrusted replacement",requirements:["Injected"]},answer:"A".repeat(140)})
});
const first = await worker.fetch(request(), {OPENAI_API_KEY:"local-test-only"});
const brief = JSON.parse(sent.input).brief;
feedback = {...feedback,score:999};
const badScore = await worker.fetch(request(), {OPENAI_API_KEY:"local-test-only"});
feedback = {...feedback,score:80,strengths:[42]};
const badList = await worker.fetch(request(), {OPENAI_API_KEY:"local-test-only"});
console.log(JSON.stringify({status:first.status,title:brief.title,requirements:brief.requirements,badScore:badScore.status,badList:badList.status}));
'''
        result = subprocess.run(['node', '--input-type=module'], input=program, text=True,
                                capture_output=True, cwd=ROOT, check=True)
        data = json.loads(result.stdout)
        self.assertEqual(data['status'], 200)
        self.assertEqual(data['title'], 'Design a multi-device chat platform')
        self.assertNotIn('Injected', data['requirements'])
        self.assertEqual((data['badScore'], data['badList']), (502, 502))

    def test_diagram_is_validated_and_reaches_the_grounded_reviewer(self):
        program = '''
import worker from "./dist/server/index.js";
let sent;
globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({output_text:JSON.stringify({score:60,summary:"Mock",strengths:[],improvements:[],followUp:"Recovery?",findings:[
  {severity:"high",dimension:"reliability",title:"Check failover",evidence:"Orders database",recommendation:"Specify recovery"},
  {severity:"high",dimension:"security",title:"Invented",evidence:"public admin password",recommendation:"Fix"}]})});};
const diagram={version:1,traffic:1000,nodes:[{id:"db",type:"database",label:"Orders database",notes:"",x:0,y:0,capacity:2000,replicas:1,latency:8}],edges:[]};
const req=d=>new Request("https://test.local/api/coach",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({problem:{id:"chat"},answer:"",diagram:d})});
const valid=await worker.fetch(req(diagram),{OPENAI_API_KEY:"local-test-only"});
const result=await valid.json();
const invalid=await worker.fetch(req({...diagram,edges:[{id:"bad",source:"db",target:"missing",protocol:"SQL",async:false,fraction:1}]}),{OPENAI_API_KEY:"local-test-only"});
console.log(JSON.stringify({status:valid.status,answer:JSON.parse(sent.input).candidateAnswer,result,invalid:invalid.status,store:sent.store}));
'''
        run = subprocess.run(['node', '--input-type=module'], input=program, capture_output=True, text=True, cwd=ROOT, check=True)
        result = json.loads(run.stdout)
        self.assertEqual(result['status'], 200)
        self.assertEqual(result['invalid'], 400)
        self.assertIn('Orders database', result['answer'])
        self.assertEqual(len(result['result']['findings']), 1)
        self.assertFalse(result['store'])
