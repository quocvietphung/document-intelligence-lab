import unittest
from document_evidence.benchmark import intersection_over_union,location_metrics


class GroundingMetricsTest(unittest.TestCase):
    def test_one_prediction_cannot_satisfy_four_identical_expected_occurrences(self):
        box=(.1,.1,.2,.2);metrics=location_metrics([box]*4,[box])
        self.assertEqual(metrics['matchedAtIoU05'],1);self.assertEqual(metrics['recallAtIoU05'],.25)
        self.assertFalse(metrics['duplicateCountExact'])

    def test_displaced_or_extra_boxes_reduce_measured_quality(self):
        self.assertEqual(intersection_over_union((0,0,.2,.2),(.5,.5,.7,.7)),0)
        m=location_metrics([(0,0,.2,.2)],[(0,0,.2,.2),(.5,.5,.7,.7)])
        self.assertEqual(m['precisionAtIoU05'],.5);self.assertEqual(m['recallAtIoU05'],1)
