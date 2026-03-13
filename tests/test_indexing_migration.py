import unittest
from pathlib import Path


MIGRATION_PATH = Path('supabase/migrations/011_tender_indexes.sql')


class IndexingMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION_PATH.read_text(encoding='utf-8')

    def test_tables_exist(self):
        self.assertIn('CREATE TABLE IF NOT EXISTS public.tender_index_documents', self.sql)
        self.assertIn('CREATE TABLE IF NOT EXISTS public.tender_index_chunks', self.sql)

    def test_revision_scoped_uniques(self):
        self.assertIn('CONSTRAINT uq_tender_index_documents_revision UNIQUE (tender_revision_pk)', self.sql)
        self.assertIn('CONSTRAINT uq_tender_index_chunks_revision_chunk_hash UNIQUE (tender_revision_pk, chunk_hash)', self.sql)


if __name__ == '__main__':
    unittest.main()
