"""Opt-in read-only SDK acceptance against an existing authorized local dossier."""
import os
from urllib.parse import urlsplit

from document_evidence.client import PlatformClient, PlatformError

origin = os.environ.get("LAB_API_URL", "http://localhost:8081")
assert urlsplit(origin).hostname in {"localhost", "127.0.0.1"}, "This acceptance is local-only"
client = PlatformClient(origin, os.environ["LAB_ACCESS_TOKEN"])
case_id = os.environ["LAB_CASE_ID"]
case = client.get_case(case_id)
assert case["id"] == case_id
assert any(item["id"] == case_id for item in client.list_cases())
assert client.workflow(case_id)["caseId"] == case_id
assert isinstance(client.audit(case_id), list)
assert isinstance(client.trust(case_id), dict)
assert isinstance(client.batches(case_id)["batches"], list)
if os.environ.get('TEST_SDK_STRUCTURE') == '1':
    structures=[doc for doc in case['documents'] if doc.get('structure')]
    assert any(doc['structure']['nativeTags']=='PRESENT_NOT_VALIDATED' and doc['structure']['blocks'] for doc in structures)
    assert any(cell.get('columnHeader') for doc in structures for table in doc['tables'] for cell in table['cells'])
    tagged=next(doc for doc in structures if doc['name']=='structure-regression.pdf')
    text=tagged['pages'][0]['text']
    assert 0<=text.index('Read this left column first.')<text.index('2. Recorded amounts')
    print('PASS installed Python SDK reads the actual persisted structural hierarchy and table header roles')
try:
    PlatformClient(origin, "invalid-sdk-fixture-token").get_case(case_id)
except PlatformError as error:
    assert error.status == 401 and error.code == "UNAUTHENTICATED"
else:
    raise AssertionError("Unauthenticated SDK access was not rejected")
try:
    client.get_case("CR-not-authorized-sdk-fixture")
except PlatformError as error:
    assert error.status == 404
else:
    raise AssertionError("Unknown dossier was accessible")
print("PASS Python SDK: live Keycloak token, six read methods, audit, unauthenticated rejection and unknown-dossier rejection; no writes or AI calls")
