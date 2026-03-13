import unittest
from pathlib import Path


MIGRATION_PATH = Path('supabase/migrations/012_matcher_notifications.sql')


class MatchNotifyMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION_PATH.read_text(encoding='utf-8')

    def test_subscriptions_profile_fields(self):
        self.assertIn("ALTER TABLE public.subscriptions", self.sql)
        self.assertIn("ADD COLUMN IF NOT EXISTS profile_fields JSONB NOT NULL DEFAULT '{}'::jsonb", self.sql)

    def test_match_results_table_and_uniqueness(self):
        self.assertIn('CREATE TABLE IF NOT EXISTS public.match_results', self.sql)
        self.assertIn('CONSTRAINT uq_match_results_subscription_revision UNIQUE (subscription_pk, tender_revision_pk)', self.sql)

    def test_delivery_retry_columns(self):
        self.assertIn('ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0', self.sql)
        self.assertIn('ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3', self.sql)
        self.assertIn('ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ', self.sql)


if __name__ == '__main__':
    unittest.main()
