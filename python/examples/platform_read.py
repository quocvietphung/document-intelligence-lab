"""Read authorized Java workflow metadata. Never print tokens or PDF content."""
import os

from document_evidence.client import PlatformClient

client = PlatformClient(os.environ.get("LAB_API_URL", "http://localhost:8081"),
                        token=lambda: os.environ["LAB_ACCESS_TOKEN"])
case_id = os.environ["LAB_CASE_ID"]
workflow = client.workflow(case_id)
print({"caseId": workflow["caseId"], "jobs": len(workflow["jobs"]),
       "auditEntries": len(client.audit(case_id))})
