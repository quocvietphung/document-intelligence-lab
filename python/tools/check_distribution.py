"""Check package contents, not a substitute for a full secret/license review."""
import email
from pathlib import Path
import sys
import tarfile
import zipfile

folder = Path(sys.argv[1])
wheels = list(folder.glob("*.whl"))
sdists = list(folder.glob("*.tar.gz"))
if len(wheels) != 1 or len(sdists) != 1:
    raise SystemExit("Expected exactly one wheel and one source distribution")
forbidden = {".pdf", ".gguf", ".onnx", ".safetensors", ".pem", ".tfstate"}

def check_names(names):
    for name in names:
        path = Path(name)
        assert not path.is_absolute() and ".." not in path.parts, "Unsafe archive path"
        assert path.suffix.lower() not in forbidden, "Private/model artifact included"
        assert not any(part in {".local", ".env", ".git", "node_modules", "__pycache__"} for part in path.parts), "Private/generated path included"

with zipfile.ZipFile(wheels[0]) as wheel:
    check_names(wheel.namelist())
    metadata_name = next(name for name in wheel.namelist() if name.endswith(".dist-info/METADATA"))
    metadata = email.message_from_bytes(wheel.read(metadata_name))
    assert metadata["Name"] == "document-evidence-lab"
    requirements = metadata.get_all("Requires-Dist", [])
    assert all("extra ==" in requirement for requirement in requirements), "Core must stay dependency-free"
    assert "document_evidence/py.typed" in wheel.namelist()
    assert any(name.endswith("/licenses/LICENSE") for name in wheel.namelist())
with tarfile.open(sdists[0]) as archive:
    check_names(archive.getnames())
print("Wheel/sdist checks passed: metadata, typed marker, license and artifact boundaries")
