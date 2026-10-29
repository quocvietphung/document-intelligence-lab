"""Prepare hash-pinned private PDF references and check authored labels, never predictions."""
import argparse,hashlib,io,json,re,unicodedata,urllib.request
from pathlib import Path
import pypdf
from pypdf import PdfReader,PdfWriter
ROOT=Path(__file__).resolve().parents[1]

def sha(data):return hashlib.sha256(data).hexdigest()
def text(value):return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',value)).casefold().strip()
def prepare(download=False):
    if pypdf.__version__!='6.10.0':raise ValueError('Use pypdf==6.10.0 for reproducible excerpts')
    catalogue=json.loads((ROOT/'lib/rag-pdf-sources.json').read_text());questions=json.loads((ROOT/'lib/rag-pdf-questions.json').read_text())
    private=ROOT/'.local/rag-benchmark';private.mkdir(parents=True,exist_ok=True,mode=0o700);documents=[];pages={}
    for source in catalogue['sources']:
        target=ROOT/source['preparedFile']
        if target.is_symlink():raise ValueError('Reference symlinks are not accepted')
        if not target.exists() and source['sourceType']=='official-public-sample':
            original=private/source.get('sourceCache',source['id']+'-original.pdf')
            if original.is_symlink():raise ValueError('Source symlinks are not accepted')
            if not original.exists():
                if not download:raise ValueError('Use --download to fetch the reviewed official PDFs explicitly')
                url=source['url']
                if not url.startswith(('https://www.cms.gov/','https://www.irs.gov/')):raise ValueError('Unreviewed download host')
                with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'DocumentEvidenceLab/1.0'}),timeout=45) as response:data=response.read(3_000_001)
                if len(data)>3_000_000 or sha(data)!=source['sourceSha256']:raise ValueError('Official source changed; review before pinning a new version')
                original.write_bytes(data);original.chmod(0o600)
            raw=original.read_bytes()
            if sha(raw)!=source['sourceSha256']:raise ValueError('Cached source hash mismatch')
            reader=PdfReader(io.BytesIO(raw))
            if reader.is_encrypted or len(reader.pages)!=source['sourcePageCount']:raise ValueError('Unexpected official PDF structure')
            writer=PdfWriter()
            for number in source['sourcePages']:writer.add_page(reader.pages[number-1],excluded_keys=('/Annots','/AA'))
            writer.add_metadata({'/Title':source['title'],'/Subject':'Research excerpt; original PDF pages '+','.join(map(str,source['sourcePages']))+'; not a complete policy, filing or advice'})
            buffer=io.BytesIO();writer.write(buffer)
            if sha(buffer.getvalue())!=source['sha256']:raise ValueError('Prepared bytes differ; verify the pinned parser version')
            with target.open('xb') as stream:stream.write(buffer.getvalue())
            target.chmod(0o600)
        if not target.is_file():raise ValueError('Prepare existing DATEV/Kaggle references first: '+source['file'])
        raw=target.read_bytes()
        if len(raw)>3_000_000 or sha(raw)!=source['sha256'] or not raw.startswith(b'%PDF-'):raise ValueError('Pinned PDF changed: '+source['file'])
        reader=PdfReader(io.BytesIO(raw))
        if reader.is_encrypted or not 1<=len(reader.pages)<=4:raise ValueError('Unsupported prepared PDF')
        extracted=[{'number':i+1,'text':page.extract_text() or ''} for i,page in enumerate(reader.pages)]
        for page in extracted:pages[(source['id'],page['number'])]=text(page['text'])
        documents.append({'id':source['id'],'name':source['file'],'sha256':source['sha256'],'preparedFile':source['preparedFile'],'split':source['split'],'pages':extracted})
    known={s['id']:s for s in catalogue['sources']};ids=set()
    for question in questions['questions']:
        if question['id'] in ids:raise ValueError('Duplicate question ID')
        ids.add(question['id']);group=known[question['group']]
        if question['split']!=group['split']:raise ValueError('Related questions cross tuning/held-out groups')
        if bool(question['relevant'])!=question['answerable']:raise ValueError('Do not invent a source for an unanswered question')
        for source in question['relevant']:
            if known[source['sourceId']]['split']!=question['split']:raise ValueError('A source crosses groups')
            page=pages[(source['sourceId'],source['page'])]
            for anchor in source['anchors']:
                if text(anchor) not in page:raise ValueError(f"Review anchor for {question['id']}: {anchor}")
    result={'format':'private-rag-native-corpus-v1','extraction':'pypdf native text; not Docling/OCR or a Qdrant service benchmark','documents':documents,'questions':questions['questions'],'labelProvenance':questions['labelProvenance']}
    output=private/'native-corpus.json';output.write_text(json.dumps(result,ensure_ascii=False));output.chmod(0o600)
    print(f"Prepared {len(documents)} private PDFs; checked {len(ids)} authored questions. Native extraction corpus: {output}")
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--download',action='store_true');prepare(parser.parse_args().download)
