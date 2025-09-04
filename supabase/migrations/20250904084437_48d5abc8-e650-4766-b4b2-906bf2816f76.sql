-- video_typeにユニーク制約を追加
ALTER TABLE public.onboarding_videos ADD CONSTRAINT onboarding_videos_video_type_unique UNIQUE (video_type);

-- ステップ3とステップ4の動画データを追加
INSERT INTO public.onboarding_videos (video_type, video_url, video_duration, completion_percentage, show_timer, custom_text)
VALUES 
  ('step3', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 300, 80, true, 'LINE APIの設定方法をご覧ください。この動画を80%視聴してから次のステップに進んでください。'),
  ('step4', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', 240, 90, true, 'ツールの使い方をご覧ください。この動画を90%視聴してから次のステップに進んでください。')
ON CONFLICT (video_type) DO UPDATE SET
  video_url = EXCLUDED.video_url,
  video_duration = EXCLUDED.video_duration,
  completion_percentage = EXCLUDED.completion_percentage,
  show_timer = EXCLUDED.show_timer,
  custom_text = EXCLUDED.custom_text,
  updated_at = now();