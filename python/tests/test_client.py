from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest

from document_evidence.client import PlatformClient, PlatformError


class ClientTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.calls = []

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                cls.calls.append((self.path, self.headers.get("Authorization")))
                if self.headers.get("Authorization") != "Bearer fixture-token":
                    self.send_response(401)
                    self.end_headers()
                    self.wfile.write(b"private server error body")
                    return
                if "CR-redirect" in self.path:
                    self.send_response(302)
                    self.send_header("Location", f"http://localhost:{self.server.server_port}/credential-sink")
                    self.end_headers()
                    return
                payload = {"/api/cases": [{"id": "CR-fixture"}],
                           "/api/cases/CR-fixture": {"id": "CR-fixture", "audit": [["fixture"]]},
                           "/api/cases/CR-fixture/platform": {"jobs": []},
                           "/api/cases/CR-fixture/trust": {"answers": []},
                           "/api/cases/CR-fixture/platform/batches": {"batches": []}}.get(self.path, {})
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())

            def do_POST(self):
                body = self.rfile.read(int(self.headers["Content-Length"]))
                cls.calls.append((self.path, self.headers.get("Authorization"), body))
                self.send_response(202)
                self.end_headers()
                self.wfile.write(b'{"id":"batch-fixture","state":"SUBMITTED"}')

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.calls.clear()

    def test_all_read_methods_use_bearer_and_existing_routes(self):
        client = PlatformClient(self.url, lambda: "fixture-token")
        self.assertEqual(client.list_cases()[0]["id"], "CR-fixture")
        self.assertEqual(client.get_case("CR-fixture")["id"], "CR-fixture")
        self.assertEqual(client.workflow("CR-fixture"), {"jobs": []})
        self.assertEqual(client.trust("CR-fixture"), {"answers": []})
        self.assertEqual(client.audit("CR-fixture"), [["fixture"]])
        self.assertEqual(client.batches("CR-fixture"), {"batches": []})
        self.assertTrue(all(call[1] == "Bearer fixture-token" for call in self.calls))

    def test_errors_do_not_leak_body_or_token_and_are_not_retried(self):
        with self.assertRaises(PlatformError) as error:
            PlatformClient(self.url, "private-token").list_cases()
        self.assertEqual(error.exception.status, 401)
        self.assertEqual(error.exception.code, "UNAUTHENTICATED")
        self.assertNotIn("private", str(error.exception))
        self.assertEqual(len(self.calls), 1)

    def test_analytics_sdk_requires_explicit_consent_version_and_stable_receipts(self):
        client = PlatformClient(self.url, "fixture-token")
        client.analytics("CR-fixture")
        self.assertEqual(self.calls[-1][0], "/api/cases/CR-fixture/platform/analytics")
        client.data_layers("CR-fixture")
        self.assertEqual(self.calls[-1][0], "/api/cases/CR-fixture/platform/etl")
        request_id = "12345678-1234-1234-1234-123456789abc"
        etl_run = "etl-" + request_id
        client.build_data_layers("CR-fixture", case_version=4, request_id=request_id, consent=True)
        self.assertEqual(json.loads(self.calls[-1][2]), {"requestId": request_id, "caseVersion": 4, "consent": True})
        client.evaluate_cohort("CR-fixture", case_version=4, etl_run_id=etl_run, request_id=request_id, consent=True)
        self.assertEqual(json.loads(self.calls[-1][2])["etlRunId"], etl_run)
        count = len(self.calls)
        for version, consent in [(-1, True), (True, True), (4, False)]:
            with self.assertRaises(ValueError):
                client.build_data_layers("CR-fixture", case_version=version, request_id=request_id, consent=consent)
        self.assertEqual(len(self.calls), count)

    def test_redirect_does_not_forward_credentials(self):
        with self.assertRaises(PlatformError) as error:
            PlatformClient(self.url, "fixture-token").get_case("CR-redirect")
        self.assertEqual(error.exception.status, 302)
        self.assertEqual(len(self.calls), 1)
        self.assertNotIn("credential-sink", self.calls[0][0])

    def test_invalid_origins_paths_and_tokens_fail_before_network(self):
        for url in ["http://remote.example", "https://user:pass@example.com", "https://example.com/api", "https://example.com?x=1", "file:///tmp/a"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                PlatformClient(url, "fixture-token")
        client = PlatformClient(self.url, "fixture-token")
        for resource in ["../other", "CR-1?tenant=other", "", "a/b"]:
            with self.assertRaises(ValueError):
                client.get_case(resource)
        for token in ["", "Bearer token", "x\r\nInjected: yes"]:
            with self.assertRaises(ValueError):
                PlatformClient(self.url, token).list_cases()
        self.assertEqual(self.calls, [])

    def test_explicit_upload_has_stable_id_consent_and_no_private_filename(self):
        client = PlatformClient(self.url, "fixture-token")
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'private-operator-name.pdf'
            file.write_bytes(b"%PDF-1.7 synthetic transport fixture")
            request_id = "11111111-1111-4111-8111-111111111111"
            with self.assertRaises(ValueError):
                client.submit_pdf("CR-fixture", file, consent=False, request_id=request_id)
            self.assertEqual(self.calls, [])
            result = client.submit_pdf("CR-fixture", file, consent=True, request_id=request_id)
            self.assertEqual(result["state"], "SUBMITTED")
            body = self.calls[0][2]
            self.assertIn(request_id.encode(), body)
            self.assertIn(file.read_bytes(), body)
            self.assertNotIn(file.name.encode(), body)
            self.assertIn(b'filename="document.pdf"', body)


if __name__ == "__main__":
    unittest.main()
