"""Generate 32 permitted synthetic PDFs with known input geometry, not human-approved ground truth."""
import hashlib
import io
import json
from contextlib import closing
from pathlib import Path
import sys
from PIL import Image
import pypdfium2 as pdfium
from pypdf import PdfReader,PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth

root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
if (root/'manifest.json').exists() or list(root.glob('fixture-*.pdf')):raise SystemExit('Refusing to overwrite a corpus')
entries=[]
for index in range(32):
    group='native' if index<12 else 'scan' if index<20 else 'mixed' if index<28 else 'visual-rotation'
    raw=io.BytesIO();c=canvas.Canvas(raw,pagesize=(600,800),invariant=1)
    c.setFont('Helvetica-Bold',16);c.drawString(45,752,f'Synthetic document inspection {index+1}')
    c.setFont('Helvetica',10);c.drawString(45,725,['Invoice research','Insurance wording research','Payroll evidence research'][index%3])
    boxes=[];value='Total: $500';font=12+index%3
    for occurrence,y in enumerate((650,530,410,290)):
        x=50+(index%3)*12
        c.setFont('Helvetica',9);c.drawString(x,y+25,f'Section {occurrence+1}: independent repeated observation')
        c.setFont('Helvetica',font);c.drawString(x,y,value)
        c.setLineWidth(.7);c.line(40,y-25,560,y-25)
        boxes.append([x/600,(800-y-font*.82)/800,(x+stringWidth(value,'Helvetica',font))/600,(800-y+font*.22)/800])
    c.setFont('Helvetica',10);c.drawString(45,90,'Original amount: 8,500 USD. Synthetic data only; no customer record.')
    c.save();content=raw.getvalue();angle=0
    if group!='native':
        with closing(pdfium.PdfDocument(content)) as pdf,closing(pdf[0]) as page,closing(page.render(scale=2)) as bitmap:image=bitmap.to_pil().convert('RGB')
        if group=='scan':angle=(0,4,-4,8)[index%4]
        if group=='mixed':angle=(0,4)[index%2]
        if group=='visual-rotation':angle=(90,180,270,90)[index%4]
        image=image.rotate(angle,resample=Image.Resampling.BICUBIC,expand=False,fillcolor='white')
        raw=io.BytesIO();c=canvas.Canvas(raw,pagesize=(600,800),invariant=1)
        c.drawImage(ImageReader(image),0,0,width=600,height=800)
        if group=='mixed':c.setFont('Helvetica',8);c.drawString(40,22,'Native footer, scanned body')
        c.save();content=raw.getvalue()
        import math
        def project(box):
            points=[];radians=math.radians(angle)
            for x,y in ((box[0],box[1]),(box[2],box[1]),(box[2],box[3]),(box[0],box[3])):
                x=x*600-300;y=y*800-400
                points.append(((math.cos(radians)*x+math.sin(radians)*y+300)/600,(-math.sin(radians)*x+math.cos(radians)*y+400)/800))
            return [min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)]
        boxes=[project(b) for b in boxes]
    elif index%3==1:
        writer=PdfWriter();page=PdfReader(io.BytesIO(content)).pages[0];page.rotate(90);writer.add_page(page)
        raw=io.BytesIO();writer.write(raw);content=raw.getvalue()
        boxes=[[1-b[3],b[0],1-b[1],b[2]] for b in boxes]
    path=root/f'fixture-{index+1:03}.pdf';path.write_bytes(content)
    entries.append({'id':path.stem,'pdf':path.name,'group':group,'sha256':hashlib.sha256(content).hexdigest(),'value':value,'page':1,'expectedBoxes':boxes,'expectedCount':4})
manifest={'format':'document-grounding-benchmark-v1','labelProvenance':'generated-known-input-not-human-approved','fixtures':entries,
          'limitations':['Synthetic templates only; no representative business accuracy claim.','Visual 90/180/270-degree scans are challenge cases; failures remain in scores.','Table semantics and reading-order accuracy are measured separately, not by this location suite.']}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('Created 32 local synthetic PDFs and a geometry manifest')
