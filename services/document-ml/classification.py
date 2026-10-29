"""Text-only research classifier over verified PDFBox page text.

No LLM, model download, filename feature, automatic document-type change or
production claim. Fixed thresholds are declared before held-out evaluation.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import time

LABELS = ['insurance-claim', 'insurance-policy', 'invoice', 'other']
METHOD = 'insurance-tfidf-logreg-v1'
MIN_SCORE, MIN_MARGIN = .60, .15


def clean(text):
    # Strip only this corpus renderer's constant research notice/header. Otherwise
    # a nearly empty page can appear long enough simply because of its disclaimer.
    text=text.split('SYNTHETIC RESEARCH DOCUMENT.',1)[0].replace('DOCUMENT INTELLIGENCE LAB','')
    # Reference numbers/amounts must not encode the label through numbering.
    return re.sub(r'\d+(?:[.,:/-]\d+)*', ' NUM ', text).strip()


def dataset(payload):
    if payload.get('format') != 'classification-input-v1':
        raise ValueError('INVALID_CLASSIFICATION_FORMAT')
    raw = payload['datasetJson']
    if len(raw.encode()) > 1_500_000 or hashlib.sha256(raw.encode()).hexdigest() != payload['datasetFingerprint']:
        raise ValueError('DATASET_CHECKSUM_MISMATCH')
    rows = json.loads(raw)
    if not 16 <= len(rows) <= 200:
        raise ValueError('BOUNDED_LABELLED_DATASET_REQUIRED')
    groups, hashes, identities = {}, {}, set()
    for row in rows:
        split, label = row['split'], row['label']
        if split not in ('train', 'validation', 'test', 'challenge') or (label not in LABELS and not (label is None and split == 'challenge')):
            raise ValueError('INVALID_LABEL_OR_SPLIT')
        if not row['group'] or not row['text'].strip() or len(row['text']) > 24_000 or not re.fullmatch(r'[a-f0-9]{64}', row['sha256']):
            raise ValueError('INVALID_PDF_OBSERVATION')
        if row['id'] in identities:
            raise ValueError('DUPLICATE_SAMPLE_ID')
        identities.add(row['id'])
        for table, key in ((groups, row['group']), (hashes, row['sha256']), (hashes, 'text:'+hashlib.sha256(clean(row['text']).encode()).hexdigest())):
            if table.setdefault(key, split) != split:
                raise ValueError('SOURCE_GROUP_LEAKAGE')
    for split in ('train', 'validation', 'test'):
        if {row['label'] for row in rows if row['split'] == split} != set(LABELS):
            raise ValueError('ALL_CLASSES_REQUIRED_IN_EACH_SPLIT')
    return rows


def fit(rows):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline, FeatureUnion
    model = Pipeline([
        ('features', FeatureUnion([
            ('word', TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, max_features=12_000)),
            ('char', TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), sublinear_tf=True, max_features=20_000)),
        ])),
        ('classifier', LogisticRegression(C=1, class_weight='balanced', max_iter=1000, random_state=17)),
    ])
    training = [r for r in rows if r['split'] == 'train']
    # Only page text enters fit. Label/group/filename metadata never becomes a feature.
    model.fit([clean(r['text']) for r in training], [r['label'] for r in training])
    return model


def metrics(rows, prediction):
    from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
    expected, actual = [r['label'] for r in rows], [r[prediction] for r in rows]
    p, recall, f1, support = precision_recall_fscore_support(expected, actual, labels=LABELS, zero_division=0)
    return {'samples': len(rows), 'accuracy': float(accuracy_score(expected, actual)),
            'macroF1': float(f1.mean()), 'confusionMatrix': confusion_matrix(expected, actual, labels=LABELS).tolist(),
            'perClass': [{'label': label, 'precision': float(p[i]), 'recall': float(recall[i]), 'f1': float(f1[i]), 'support': int(support[i])} for i, label in enumerate(LABELS)]}


def review_reasons(text, predicted, rule, score, margin):
    reasons = []
    if len(clean(text).split()) < 20:
        reasons.append('SHORT_TEXT')
    if score < MIN_SCORE:
        reasons.append('LOW_MODEL_SCORE')
    if margin < MIN_MARGIN:
        reasons.append('SMALL_MARGIN')
    if rule != predicted:
        reasons.append('RULE_MODEL_DISAGREEMENT')
    return reasons


def evaluate(payload, models_root=None, tracking_uri=None):
    import sklearn
    from engine import save_model
    started = time.monotonic()
    rows = dataset(payload)
    model = fit(rows)
    observed = []
    for row in rows:
        if row['split'] == 'train':
            continue
        probabilities = model.predict_proba([clean(row['text'])])[0]
        order = probabilities.argsort()[::-1]
        predicted = str(model.classes_[order[0]])
        score, margin = float(probabilities[order[0]]), float(probabilities[order[0]]-probabilities[order[1]])
        reasons = review_reasons(row['text'], predicted, row['ruleLabel'], score, margin)
        observed.append({k: row[k] for k in ('id','label','group','split','sha256','page','ruleLabel','ruleType')} |
                        {'modelLabel': predicted, 'score': score, 'margin': margin, 'needsReview': bool(reasons), 'reviewReasons': reasons,
                         'expectedReview': row['split'] == 'challenge'})
    result = {'method': METHOD, 'datasetVersion': payload['datasetVersion'], 'datasetFingerprint': payload['datasetFingerprint'],
              'status': 'COMPLETE', 'library': 'scikit-learn '+sklearn.__version__, 'labels': LABELS,
              'splits': dict(Counter(r['split'] for r in rows)), 'groupSplits': {split: sorted({r['group'] for r in rows if r['split']==split}) for split in ('train','validation','test','challenge')},
              'parameters': {'C':1,'classWeight':'balanced','seed':17,'wordNgrams':[1,2],'charNgrams':[3,5],'minimumScore':MIN_SCORE,'minimumMargin':MIN_MARGIN},
              'modelInputs':['pageText'], 'scoreCalibrated': False, 'thresholdSelection': 'Fixed before the first held-out evaluation; not tuned on test/challenge.',
              'metrics': {}, 'rows': observed, 'tracking': 'NOT_REQUESTED', 'cloudCalls':0, 'documentTypesChanged':0,
              'limitations': [
                  'All benchmark PDFs and labels are authored synthetic fixtures, not Zurich documents or representative customer data.',
                  'Template families and exact original/text hashes do not cross splits; all templates still share one author and renderer.',
                  'This development/reference corpus was inspected during implementation; it is not a blind independent holdout.',
                  'This is classical text ML, not a trained deep-learning or visual-layout model.',
                  'Native PDFBox text is evaluated; scanned OCR robustness is not measured.',
                  'Scores are uncalibrated model estimates, not validated confidence. Review routing is not production approval.',
                  'The four labels are a closed set. Mixed packets and unknown languages are not reliably detected automatically.',
                  'Rule output is mapped to four benchmark labels; unsupported rule types map to other for this comparison.',
                  'Macro F1 here is classification quality, not RAG retrieval or answer factuality.',
              ]}
    for split in ('validation', 'test'):
        part = [r for r in observed if r['split']==split]
        accepted = [r for r in part if not r['needsReview']]
        result['metrics'][split] = {'rule':metrics(part,'ruleLabel'), 'model':metrics(part,'modelLabel'),
                                   'routing':{'reviewRequired':sum(r['needsReview'] for r in part),'accepted':len(accepted),
                                              'coverage':len(accepted)/len(part),
                                              'acceptedAccuracy':sum(r['label']==r['modelLabel'] for r in accepted)/len(accepted) if accepted else None}}
    challenge = [r for r in observed if r['split']=='challenge']
    result['challenge'] = {'samples':len(challenge),'reviewExpected':len(challenge),'reviewRouted':sum(r['needsReview'] for r in challenge),
                           'missedReview':[r['id'] for r in challenge if not r['needsReview']]}
    if models_root:
        result.update(save_model(model, Path(models_root), {'method':METHOD,'datasetFingerprint':payload['datasetFingerprint'],
                     'library':sklearn.__version__,'trainingSourceHashes':sorted(r['sha256'] for r in rows if r['split']=='train'),'operationalApproval':False}))
    result['elapsedMs'] = round((time.monotonic()-started)*1000)
    if tracking_uri:
        track(result, tracking_uri)
    return result


def track(result, uri):
    if not uri.startswith('sqlite:////'):
        raise ValueError('LOCAL_SQLITE_TRACKING_REQUIRED')
    os.environ['MLFLOW_DISABLE_TELEMETRY']='true'
    import mlflow
    location=Path(uri.removeprefix('sqlite:///')); location.parent.mkdir(parents=True, exist_ok=True)
    mlflow.set_tracking_uri(uri)
    client=mlflow.MlflowClient(); name='insurance-document-classification'
    if client.get_experiment_by_name(name) is None:
        client.create_experiment(name, artifact_location=(location.parent/'artifacts').as_uri())
    mlflow.set_experiment(name)
    with mlflow.start_run() as run:
        mlflow.log_params({'method':METHOD,'dataset_fingerprint':result['datasetFingerprint'],'synthetic':True,'split_unit':'template-family',
                           'seed':17,'score_calibrated':False,'minimum_score':MIN_SCORE,'minimum_margin':MIN_MARGIN})
        test=result['metrics']['test']
        mlflow.log_metrics({'test_samples':test['model']['samples'],'rule_macro_f1':test['rule']['macroF1'],
                            'model_macro_f1':test['model']['macroF1'],'review_coverage':test['routing']['coverage'],
                            'challenge_review_routed':result['challenge']['reviewRouted'],'elapsed_ms':result['elapsedMs']})
        if result.get('modelSha256'):
            mlflow.log_param('model_sha256',result['modelSha256'])
        result.update(tracking='RECORDED',trackingRunId=run.info.run_id)


def process(root):
    from engine import atomic_json
    root=Path(root)
    for path in sorted((root/'classification-queue').glob('*/*.input.json'))[:20]:
        output=path.with_name(path.name.replace('.input.json','.result.json'))
        if output.exists() or path.is_symlink() or path.stat().st_size>2_000_000:
            continue
        request={}
        try:
            request=json.loads(path.read_text())
            if (not re.fullmatch(r'[a-f0-9]{64}',request['scope']) or request['scope']!=path.parent.name
                or not re.fullmatch(r'class-[a-f0-9-]{36}',request['id']) or path.name!=request['id']+'.input.json'):
                raise ValueError('INVALID_CLASSIFICATION_REQUEST')
            result=evaluate(request,root/'classification-models'/request['scope']/request['id'],os.environ.get('MLFLOW_TRACKING_URI'))
            receipt={'id':request['id'],'datasetFingerprint':request['datasetFingerprint'],'status':'COMPLETE','result':result}
        except Exception:
            receipt={'id':request.get('id',''),'datasetFingerprint':request.get('datasetFingerprint',''),'status':'FAILED','errorCode':'CLASSIFICATION_EVALUATION_FAILED'}
        receipt['finishedAt']=datetime.now(timezone.utc).isoformat()
        atomic_json(output,receipt)


if __name__=='__main__':
    from engine import atomic_json
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True); parser.add_argument('--output',required=True)
    parser.add_argument('--models-root'); parser.add_argument('--tracking-uri')
    args=parser.parse_args()
    if Path(args.output).exists():
        parser.error('Choose a new result path; previous results are immutable.')
    atomic_json(args.output,evaluate(json.loads(Path(args.input).read_text()),args.models_root,args.tracking_uri))
