"""Static corpus contract checks; CI does not download publisher PDFs or models."""
import hashlib,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class RagCorpusContract(unittest.TestCase):
 def setUp(self):
  self.sources=json.loads((ROOT/'lib/rag-pdf-sources.json').read_text())['sources'];self.questions=json.loads((ROOT/'lib/rag-pdf-questions.json').read_text())['questions'];self.catalogue={s['id']:s for s in self.sources}
 def test_sources_are_pinned_private_and_attributed(self):
  self.assertEqual(len(self.catalogue),len(self.sources))
  for source in self.sources:
   self.assertRegex(source['sha256'],r'^[a-f0-9]{64}$');self.assertTrue(source['preparedFile'].startswith('.local/'));self.assertNotIn('..',Path(source['preparedFile']).parts);self.assertTrue(source['publisher']);self.assertTrue(source['rights']);self.assertTrue(source['sourcePages'])
  self.assertEqual(len({s['sha256'] for s in self.sources}),len(self.sources))
  groups={}
  for source in self.sources:
   digest=source['sourceSha256'];self.assertEqual(groups.setdefault(digest,source['split']),source['split'],'Excerpts of one publisher PDF must not cross groups')
 def test_every_question_has_one_group_and_never_invents_negative_sources(self):
  ids=set()
  for q in self.questions:
   self.assertNotIn(q['id'],ids);ids.add(q['id']);self.assertEqual(q['split'],self.catalogue[q['group']]['split']);self.assertEqual(bool(q['relevant']),q['answerable']);self.assertIn(q['locale'],['en','de','vi'])
   for source in q['relevant']:
    self.assertEqual(q['split'],self.catalogue[source['sourceId']]['split']);self.assertGreater(source['page'],0);self.assertLessEqual(source['page'],len(self.catalogue[source['sourceId']]['sourcePages']));self.assertTrue(source['anchors'])
 def test_suite_retains_languages_multi_page_and_unanswerable_cases(self):
  self.assertEqual({q['locale'] for q in self.questions},{'en','de','vi'});self.assertEqual({q['split'] for q in self.questions},{'tune','holdout'});self.assertEqual(sum(not q['answerable'] for q in self.questions),8);self.assertTrue(any(len(q['relevant'])>1 for q in self.questions));self.assertLessEqual(len(self.questions),100)
if __name__=='__main__':unittest.main()
