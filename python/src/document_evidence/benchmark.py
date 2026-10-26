"""Small location benchmark with explicit misses; no claimed business-document accuracy."""
import argparse
from collections import defaultdict
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import statistics
import time
from .inspection import ground_pdf
from .reader import DocumentReadError


def intersection_over_union(a,b):
    overlap=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
    union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-overlap
    return overlap/union if union>0 else 0.0


def location_metrics(expected,predicted):
    pairs=sorted(((intersection_over_union(a,b),i,j) for i,a in enumerate(expected) for j,b in enumerate(predicted)),reverse=True)
    used_expected=set();used_predicted=set();scores=[]
    for score,i,j in pairs:
        if score<.5 or i in used_expected or j in used_predicted:continue
        used_expected.add(i);used_predicted.add(j);scores.append(score)
    return {'expected':len(expected),'predicted':len(predicted),'matchedAtIoU05':len(scores),
            'precisionAtIoU05':len(scores)/len(predicted) if predicted else 0.0,
            'recallAtIoU05':len(scores)/len(expected) if expected else 1.0,
            'duplicateCountExact':len(expected)==len(predicted),'meanMatchedIoU':statistics.mean(scores) if scores else None}


def evaluate(manifest_path):
    root=Path(manifest_path).resolve().parent;manifest=json.loads(Path(manifest_path).read_text())
    if manifest.get('format')!='document-grounding-benchmark-v1' or not 1<=len(manifest['fixtures'])<=100:raise ValueError('Invalid bounded benchmark')
    results=[];groups=defaultdict(list)
    for fixture in manifest['fixtures']:
        if not 0<=len(fixture['expectedBoxes'])<=100 or any(len(b)!=4 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in b) or not (0<=b[0]<b[2]<=1 and 0<=b[1]<b[3]<=1) for b in fixture['expectedBoxes']):raise ValueError('Invalid bounded reference geometry')
        source=(root/fixture['pdf']).resolve()
        if not source.is_relative_to(root) or not source.is_file() or source.stat().st_size>3_000_000:raise ValueError('Invalid local fixture')
        if hashlib.sha256(source.read_bytes()).hexdigest()!=fixture['sha256']:raise ValueError('Fixture changed')
        started=time.monotonic();error=None;engines={}
        try:
            reply=ground_pdf(source,fixture['value'],page=fixture['page'],timeout_seconds=120)
            predicted=[c.bbox for c in reply.candidates];engines=dict(reply.engine_versions)
            assert reply.selected_id is None and reply.human_review_required
        except DocumentReadError as failure:
            predicted=[];error=str(failure)
        result={'id':fixture['id'],'group':fixture['group'],'sha256':fixture['sha256'],**location_metrics(fixture['expectedBoxes'],predicted),
                'seconds':round(time.monotonic()-started,3),'errorCode':error,'engineVersions':engines}
        results.append(result);groups[fixture['group']].append(result)
    summary={group:{'documents':len(rows),'expected':sum(r['expected'] for r in rows),'locatedAtIoU05':sum(r['matchedAtIoU05'] for r in rows),
                    'exactDuplicateCounts':sum(r['duplicateCountExact'] for r in rows),'errors':sum(bool(r['errorCode']) for r in rows)} for group,rows in groups.items()}
    return {'format':'document-grounding-results-v1','labelProvenance':manifest['labelProvenance'],'documents':len(results),'platform':platform.system()+' '+platform.machine(),
            'python':platform.python_version(),'matching':'greedy-one-to-one-IoU>=0.5','groups':summary,'results':results,'limitations':manifest['limitations']}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('manifest');parser.add_argument('--output',required=True);args=parser.parse_args()
    report=evaluate(args.manifest)
    with os.fdopen(os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as output:json.dump(report,output,indent=2)
    print(json.dumps({'documents':report['documents'],'groups':report['groups']}))
