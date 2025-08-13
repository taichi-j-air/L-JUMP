-- トリガーを削除してデータの直接保存を有効にする
DROP TRIGGER IF EXISTS set_submission_user_id_trigger ON form_submissions;
DROP FUNCTION IF EXISTS set_submission_user_id();