# Third-party boundaries

The [MIT license](LICENSE) covers this project's own source code. It does not relicense dependencies, container images, model weights, cloud services or publisher-owned documents.

| Component or material | Where its terms come from |
| --- | --- |
| npm dependencies | Installed package `LICENSE`/`NOTICE` files and the package-lock license metadata. Keep upstream notices when redistributing a bundle. |
| Java dependencies | Maven POM/license information; the security workflow generates a CycloneDX SBOM. An SBOM is an inventory, not a legal review. |
| Docling and Docling Serve | [Docling](https://github.com/docling-project/docling) and [Docling Serve](https://github.com/docling-project/docling-serve) code are MIT. Models and dependencies used by their images retain their own licenses. |
| MiniLM embedding model | [Model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) and the packaged ONNX artifact's notices. Model weights are not relicensed by this repository. |
| PostgreSQL, Keycloak, Redis, Qdrant, ClamAV and other containers | Exact upstream image/version terms. In particular, do not assume every service uses MIT or Apache 2.0. |
| Azure OpenAI / Document Intelligence | Azure service terms, deployed-model terms and your organization's data-processing policies. They are not bundled open-source engines or free unlimited inference. |
| DATEV and Kaggle references | Publisher/source terms documented in the README. Downloaded PDFs stay private under `.local/`; they are not distributed with the repository or images. |
| Test-only PDFs | Self-authored fictional fixtures under `src/test/resources/legacy-*`; not official DATEV documents or real customer data. |
| Nova portrait | AI-generated fictional adult character. Not a real employee or an endorsement by a model/document publisher. |

Screenshots can contain visible source material and require their own publication review. Keeping a full PDF out of Git does not automatically clear rights for its screenshot. No endorsement by DATEV, Kaggle, Microsoft, IBM, apoBank or an insurance publisher is implied.

Before redistribution, review exact dependency/model/image versions, preserve applicable notices and verify permission for included assets. Hugging Face hosting is a distribution channel, not a blanket license grant. This file describes boundaries and is not a complete transitive-license clearance.
