"""Contract tests, separate from the measured native-PDF benchmark."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from uuid import uuid4

from classification import dataset, evaluate, fit, metrics, process


def payload():
    cues={'insurance-claim':'water damaged window loss repair incident claim report',
          'insurance-policy':'contract coverage premium protection policy certificate insured',
          'invoice':'invoice total tax billed material labour payment amount',
          'other':'general information opening hours privacy contact appointment leaflet'}
    rows=[]
    for label,text in cues.items():
        for index,style in enumerate(['alphaform','betanote','gammaletter','validationsheet','heldoutonlyword','mixedpacket']):
            split='train' if index<3 else 'validation' if index==3 else 'test' if index==4 else 'challenge'
            identity=f'sample-{len(rows)}'
            rows.append({'id':identity,'label':label if split!='challenge' else None,'group':f'{label}-{style}','split':split,
                         'sha256':hashlib.sha256(identity.encode()).hexdigest(),'page':1,'ruleLabel':label,'ruleType':label,
                         'text':(text+' ')*5+style,'file':'metadata-never-a-feature.pdf'})
    value={'format':'classification-input-v1','datasetVersion':'unit-contract-fixtures','datasetJson':json.dumps(rows)}
    value['datasetFingerprint']=hashlib.sha256(value['datasetJson'].encode()).hexdigest()
    return value


class ClassificationTest(unittest.TestCase):
    def test_model_fits_only_training_text_and_excludes_metadata(self):
        rows=dataset(payload());model=fit(rows)
        vocabulary=model.named_steps['features'].transformer_list[0][1].vocabulary_
        self.assertNotIn('heldoutonlyword',vocabulary)
        self.assertNotIn('metadata',vocabulary)
        self.assertEqual(model.classes_.size,4)

    def test_every_forced_choice_is_counted_and_gates_are_separate(self):
        value=payload();result=evaluate(value)
        for split in ('validation','test'):
            for method in ('rule','model'):
                measured=result['metrics'][split][method]
                self.assertEqual(sum(sum(row) for row in measured['confusionMatrix']),4)
                self.assertEqual(sum(row['support'] for row in measured['perClass']),4)
        self.assertEqual(result['modelInputs'],['pageText'])
        self.assertFalse(result['scoreCalibrated'])
        self.assertEqual(result['cloudCalls'],0)
        self.assertEqual(result['documentTypesChanged'],0)
        self.assertEqual(result['challenge']['samples'],4)
        self.assertEqual(result['rows'],evaluate(value)['rows'])

    def test_macro_f1_is_not_accuracy_or_retrieval_hit_rate(self):
        rows=[{'label':'invoice','prediction':'invoice'},{'label':'insurance-claim','prediction':'invoice'}]
        report=metrics(rows,'prediction')
        self.assertEqual(report['accuracy'],.5)
        self.assertAlmostEqual(report['macroF1'],1/6)
        invoice=next(row for row in report['perClass'] if row['label']=='invoice')
        self.assertEqual(invoice['precision'],.5)
        self.assertEqual(invoice['recall'],1)

    def test_changed_input_and_source_family_leakage_are_rejected(self):
        value=payload();value['datasetJson']+=' '
        with self.assertRaisesRegex(ValueError,'CHECKSUM'):dataset(value)
        value=payload();rows=json.loads(value['datasetJson']);rows[4]['group']=rows[0]['group']
        value['datasetJson']=json.dumps(rows);value['datasetFingerprint']=hashlib.sha256(value['datasetJson'].encode()).hexdigest()
        with self.assertRaisesRegex(ValueError,'SOURCE_GROUP_LEAKAGE'):dataset(value)
        rows[4]['group']='separate';rows[4]['sha256']=rows[0]['sha256']
        value['datasetJson']=json.dumps(rows);value['datasetFingerprint']=hashlib.sha256(value['datasetJson'].encode()).hexdigest()
        with self.assertRaisesRegex(ValueError,'SOURCE_GROUP_LEAKAGE'):dataset(value)

    def test_model_artifact_tracks_exact_training_sources_and_local_mlflow(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);value=payload()
            result=evaluate(value,root/'model','sqlite:///'+str(root/'tracking/mlflow.db'))
            metadata=json.loads((root/'model/model.json').read_text())
            self.assertFalse(metadata['operationalApproval'])
            expected=sorted(row['sha256'] for row in dataset(value) if row['split']=='train')
            self.assertEqual(metadata['trainingSourceHashes'],expected)
            self.assertEqual(result['tracking'],'RECORDED')
            self.assertTrue(result['trackingRunId'])

    def test_worker_rejects_a_cross_scope_request_without_training(self):
        with tempfile.TemporaryDirectory() as directory:
            scope='a'*64;root=Path(directory);queue=root/'classification-queue'/scope;queue.mkdir(parents=True)
            identity='class-'+str(uuid4());value=payload()|{'id':identity,'scope':'b'*64}
            path=queue/(identity+'.input.json');path.write_text(json.dumps(value))
            process(root)
            result=json.loads(path.with_name(identity+'.result.json').read_text())
            self.assertEqual(result['status'],'FAILED')
            self.assertFalse((root/'classification-models').exists())


if __name__=='__main__':unittest.main()
