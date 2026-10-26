import unittest
from document_evidence.quality import compare_observations


class ObservationComparisonTest(unittest.TestCase):
    def test_disagreement_preserves_both_values_and_never_corrects_or_approves(self):
        result=compare_observations('3,500 USD','8,500 USD')
        self.assertEqual(result['status'],'DIFFERENT')
        self.assertTrue(result['numericDisagreement'])
        self.assertEqual(result['recordedText'],'3,500 USD')
        self.assertEqual(result['independentOcrText'],'8,500 USD')
        self.assertFalse(result['automaticCorrection']);self.assertTrue(result['humanReviewRequired'])

    def test_agreement_missing_text_and_currency_disagreement_are_distinct(self):
        self.assertEqual(compare_observations('500 USD','500  USD')['status'],'AGREEMENT_NOT_VERIFIED')
        self.assertEqual(compare_observations('500 USD','')['status'],'NOT_COMPARABLE')
        result=compare_observations('500 USD','500 EUR')
        self.assertEqual(result['status'],'DIFFERENT');self.assertFalse(result['numericDisagreement'])
