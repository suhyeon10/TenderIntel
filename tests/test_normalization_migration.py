import unittest
from pathlib import Path


MIGRATION_PATH = Path('supabase/migrations/010_tender_revisions_status.sql')


class NormalizationMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION_PATH.read_text(encoding='utf-8')

    def test_status_columns_added(self):
        self.assertIn('ADD COLUMN IF NOT EXISTS revision_status TEXT NOT NULL DEFAULT \'SUCCESS\'', self.sql)
        self.assertIn('ADD COLUMN IF NOT EXISTS error_message TEXT', self.sql)

    def test_status_constraint_exists(self):
        self.assertIn("CHECK (revision_status IN ('SUCCESS', 'FAILED'))", self.sql)


if __name__ == '__main__':
    unittest.main()
