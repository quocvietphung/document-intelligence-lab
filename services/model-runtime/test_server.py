import unittest
from server import Table, parsed_page, texts, model_path


class ContractTests(unittest.TestCase):
    def test_table_spans_and_no_html_execution(self):
        table = Table()
        table.feed('<table><tr><th rowspan="2">Item</th><th>EUR</th></tr><tr><td>12,50</td></tr></table>')
        self.assertEqual((table.rows, table.columns), (2, 2))
        self.assertEqual(table.cells[-1], {"row": 1, "column": 1, "text": "12,50"})

    def test_page_order_and_unknown_confidence(self):
        page, tables = parsed_page({"res": {"parsing_res_list": [
            {"block_label": "text", "block_content": "Fictional invoice"},
            {"block_label": "table", "block_content": "<table><tr><td>Total</td><td>INR 1200.50</td></tr></table>"}]}}, 2)
        self.assertEqual(page["number"], 2)
        self.assertIn("INR 1200.50", page["text"])
        self.assertNotIn("confidence", page)
        self.assertEqual(tables[0]["page"], 2)

    def test_rejects_bounds_and_missing_models_without_download(self):
        for bad in ({"texts": []}, {"texts": ["x"] * 25}, {"texts": ["x" * 12001]}):
            with self.assertRaises(ValueError):
                texts(bad)
        with self.assertRaises(RuntimeError):
            model_path("does-not-exist")
        with self.assertRaises(ValueError):
            parsed_page({"res": {"parsing_res_list": []}}, 1)


if __name__ == "__main__":
    unittest.main()
