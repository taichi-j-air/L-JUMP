-- ステップ3とステップ4の動画データを追加（削除してから挿入）
DELETE FROM public.onboarding_videos WHERE video_type IN ('step3', 'step4');

INSERT INTO public.onboarding_videos (video_type, video_url, video_duration, completion_percentage, show_timer, custom_text)
VALUES 
  ('step3', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 300, 80, true, 'LINE APIの設定方法をご覧ください。この動画を80%視聴してから次のステップに進んでください。'),
  ('step4', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', 240, 90, true, 'ツールの使い方をご覧ください。この動画を90%視聴してから次のステップに進んでください。');