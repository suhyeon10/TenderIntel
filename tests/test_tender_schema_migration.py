import re
import unittest
from pathlib import Path


MIGRATION_PATH = Path('supabase/migrations/008_tenderintel_v2_schema.sql')


class TenderSchemaMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION_PATH.read_text(encoding='utf-8')

    def test_migration_file_exists(self):
        self.assertTrue(MIGRATION_PATH.exists(), f'Missing migration file: {MIGRATION_PATH}')

    def test_required_tables_exist(self):
        for table in [
            'tenders',
            'tender_revisions',
            'attachments',
            'extraction_results',
            'subscriptions',
            'delivery_logs',
        ]:
            self.assertRegex(
                self.sql,
                rf'CREATE TABLE IF NOT EXISTS\s+public\.{table}\b',
                f'Missing CREATE TABLE for {table}',
            )

    def test_unique_key_strategy(self):
        self.assertIn(
            'CONSTRAINT uq_tenders_source_tender_id UNIQUE (source, tender_id)',
            self.sql,
        )
        self.assertIn(
            'CONSTRAINT uq_tender_revisions_tender_pk_revision_hash UNIQUE (tender_pk, revision_hash)',
            self.sql,
        )

    def test_change_detection_hash_fields_exist(self):
        required_fields = [
            'latest_raw_content_hash TEXT',
            'latest_normalized_content_hash TEXT',
            'revision_hash TEXT NOT NULL',
            'raw_content_hash TEXT NOT NULL',
            'normalized_content_hash TEXT NOT NULL',
        ]
        for field in required_fields:
            self.assertIn(field, self.sql)

    def test_revision_append_only_guards_exist(self):
        self.assertIn(
            'CONSTRAINT uq_tender_revisions_tender_pk_revision_number UNIQUE (tender_pk, revision_number)',
            self.sql,
        )


if __name__ == '__main__':
    unittest.main()
