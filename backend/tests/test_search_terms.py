import unittest

from app.search_terms import expand_query


class ExpandQueryTests(unittest.TestCase):
    def test_earphones_also_finds_earbuds_and_headphones(self):
        terms = expand_query("earphones").split()

        self.assertIn("earbuds", terms)
        self.assertIn("headphones", terms)
        self.assertEqual(terms[0], "earphones")

    def test_typo_in_a_synonym_word_still_expands(self):
        self.assertIn("earbuds", expand_query("earphons").split())

    def test_unrelated_queries_are_left_untouched(self):
        self.assertEqual(expand_query("Wireless Mouse"), "Wireless Mouse")
        self.assertEqual(expand_query("bluetoth"), "bluetoth")

    def test_short_words_are_not_fuzzy_matched(self):
        self.assertEqual(expand_query("lap top"), "lap top")

    def test_other_words_in_the_query_are_kept(self):
        terms = expand_query("wireless earbuds").split()

        self.assertIn("wireless", terms)
        self.assertIn("headphones", terms)


if __name__ == "__main__":
    unittest.main()
