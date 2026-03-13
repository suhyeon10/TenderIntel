import unittest
from pathlib import Path


MIGRATION_PATH = Path('supabase/migrations/009_ingestion_raw_payloads_and_jobs.sql')


class IngestionMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION_PATH.read_text(encoding='utf-8')

    def test_required_tables_exist(self):
        for table in ['raw_payloads', 'ingestion_jobs', 'failed_jobs']:
            self.assertIn(f'CREATE TABLE IF NOT EXISTS public.{table}', self.sql)

    def test_idempotency_uniques_exist(self):
        self.assertIn('CONSTRAINT uq_raw_payloads_revision_content_hash UNIQUE (tender_revision_pk, content_hash)', self.sql)
        self.assertIn('CONSTRAINT uq_ingestion_jobs_job_name_idempotency UNIQUE (job_name, idempotency_key)', self.sql)
        self.assertIn('CONSTRAINT uq_failed_jobs_job_name_idempotency UNIQUE (job_name, idempotency_key)', self.sql)


if __name__ == '__main__':
    unittest.main()
