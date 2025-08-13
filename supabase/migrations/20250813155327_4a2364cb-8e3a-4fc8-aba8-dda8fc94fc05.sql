-- 依存オブジェクトとともにトリガーと関数を削除する
DROP TRIGGER IF EXISTS trg_set_submission_user_id ON form_submissions CASCADE;
DROP FUNCTION IF EXISTS set_submission_user_id() CASCADE;