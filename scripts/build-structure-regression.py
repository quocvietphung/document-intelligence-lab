"""Create two self-authored structural/OCR fixtures; not PDF/UA reference files.

The tagged page deliberately draws the right column before the left column.
The structure tree records the intended left-to-right logical sequence.
The raster fixture has no text layer: upright scan followed by a 4-degree scan.
No customer, publisher, personal, or cloud data. Outputs are never overwritten.
"""
import io
import sys
from contextlib import closing
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, BooleanObject, DictionaryObject, NameObject, NumberObject
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

folder=Path(sys.argv[1]);folder.mkdir(parents=True,exist_ok=True)
tagged=folder/'structure-regression.pdf';scanned=folder/'scanned-skew-regression.pdf'
if tagged.exists() or scanned.exists():
    raise SystemExit('Refusing to overwrite existing fixtures')
raw=io.BytesIO();c=canvas.Canvas(raw,pagesize=(600,800),invariant=1)

def text(mcid,role,x,y,value,size=11,bold=False):
    c._code.append(f'/{role} <</MCID {mcid}>> BDC')
    c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,y,value)
    c._code.append('EMC')

text(0,'LabHeading',40,748,'Document structure regression',18,True)
text(1,'P',40,721,'Synthetic research fixture. No accessibility certification is claimed.',10)
# Intentionally paint right first: text extraction order is not logical reading order.
text(5,'H2',330,665,'2. Recorded amounts',13,True)
text(6,'P',330,637,'Inspect headers, rows and units.',10)
c.setLineWidth(.8)
for y in (598,566,534,502):c.line(330,y,560,y)
for x in (330,455,560):c.line(x,502,x,598)
text(7,'TH',338,578,'Item',10,True);text(8,'TH',463,578,'Amount (USD)',10,True)
text(9,'TD',338,546,'Inspection',10);text(10,'TD',463,546,'8,500',11)
text(11,'TD',338,514,'Storage',10);text(12,'TD',463,514,'500',11)
text(2,'H2',40,665,'1. Review checklist',13,True)
text(3,'P',40,632,'1. Read this left column first.',11)
text(4,'P',40,603,'2. Check the amounts on the right.',11)
c.setFont('Helvetica',9);c.drawString(40,55,'Self-authored regression data - not a customer document or valid PDF/UA exemplar.')
c.save()
writer=PdfWriter();writer.add_page(PdfReader(raw).pages[0]);page=writer.pages[0]
page[NameObject('/StructParents')]=NumberObject(0)
root=DictionaryObject({NameObject('/Type'):NameObject('/StructTreeRoot')});root_ref=writer._add_object(root)
parents=[None]*13

def node(role,parent,mcid=None,children=None,scope=False):
    obj=DictionaryObject({NameObject('/Type'):NameObject('/StructElem'),NameObject('/S'):NameObject('/'+role),NameObject('/P'):parent,NameObject('/Pg'):page.indirect_reference})
    ref=writer._add_object(obj)
    if mcid is not None:obj[NameObject('/K')]=NumberObject(mcid);parents[mcid]=ref
    if children is not None:obj[NameObject('/K')]=ArrayObject(children)
    if scope:obj[NameObject('/A')]=DictionaryObject({NameObject('/O'):NameObject('/Table'),NameObject('/Scope'):NameObject('/Column')})
    return ref,obj

doc,doc_obj=node('Document',root_ref)
left,left_obj=node('Sect',doc);right,right_obj=node('Sect',doc)
heading,_=node('LabHeading',doc,0);intro,_=node('P',doc,1)
lh,_=node('H2',left,2);listing,list_obj=node('L',left)
items=[]
for mcid in (3,4):
    li,li_obj=node('LI',listing);body,_=node('LBody',li,mcid);li_obj[NameObject('/K')]=body;items.append(li)
list_obj[NameObject('/K')]=ArrayObject(items);left_obj[NameObject('/K')]=ArrayObject([lh,listing])
rh,_=node('H2',right,5);rp,_=node('P',right,6);table,table_obj=node('Table',right)
rows=[]
for row,mcids in enumerate(((7,8),(9,10),(11,12))):
    tr,tr_obj=node('TR',table);cells=[]
    for mcid in mcids:cells.append(node('TH' if row==0 else 'TD',tr,mcid,scope=row==0)[0])
    tr_obj[NameObject('/K')]=ArrayObject(cells);rows.append(tr)
table_obj[NameObject('/K')]=ArrayObject(rows);right_obj[NameObject('/K')]=ArrayObject([rh,rp,table])
doc_obj[NameObject('/K')]=ArrayObject([heading,intro,left,right])
root[NameObject('/K')]=ArrayObject([doc]);root[NameObject('/RoleMap')]=DictionaryObject({NameObject('/LabHeading'):NameObject('/H1')})
root[NameObject('/ParentTree')]=writer._add_object(DictionaryObject({NameObject('/Nums'):ArrayObject([NumberObject(0),ArrayObject(parents)])}))
root[NameObject('/ParentTreeNextKey')]=NumberObject(1)
writer._root_object[NameObject('/StructTreeRoot')]=root_ref
writer._root_object[NameObject('/MarkInfo')]=DictionaryObject({NameObject('/Marked'):BooleanObject(True)})
with tagged.open('xb') as f:writer.write(f)

reference=Path(__file__).resolve().parents[1]/'services/credit-api/src/test/resources/evidence/evidence-inspection-regression.pdf'
with closing(pdfium.PdfDocument(str(reference))) as pdf:
    with closing(pdf[0]) as page:
        with closing(page.render(scale=2.5,may_draw_forms=False)) as bitmap:image=bitmap.to_pil().convert('RGB')
raw=io.BytesIO();c=canvas.Canvas(raw,pagesize=(600,800),invariant=1)
for angle in (0,4):
    rotated=image.rotate(angle,resample=Image.Resampling.BICUBIC,expand=False,fillcolor='white')
    c.drawImage(ImageReader(rotated),0,0,width=600,height=800)
    c.showPage()
c.save()
with scanned.open('xb') as f:f.write(raw.getvalue())
print('Created structure-regression.pdf and scanned-skew-regression.pdf')
