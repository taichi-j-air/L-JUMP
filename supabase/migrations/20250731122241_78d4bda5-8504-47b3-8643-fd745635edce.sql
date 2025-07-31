-- step_messagesテーブルにflex_message_idカラムを追加
ALTER TABLE step_messages ADD COLUMN flex_message_id UUID;

-- step_scenariosテーブルにscenario_orderカラムを追加（シナリオ順序管理のため）
ALTER TABLE step_scenarios ADD COLUMN scenario_order INTEGER DEFAULT 0;