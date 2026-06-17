-- ============================================================
-- 社区模块数据库 Schema
-- 运行方式: 在 Neon 控制台执行，或通过 API init 接口触发
-- ============================================================

-- 圈子表（可选，v1.0 硬编码前端）
CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,          -- 'primary' | 'middle' | ...
  name TEXT NOT NULL,
  description TEXT,
  age_range TEXT                 -- '3-6' | '6-9' | '9-12' | '12-15' | 'all'
);

-- 用户表（简化版，v1.0 主要存昵称）
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  circle_id TEXT NOT NULL DEFAULT 'primary',
  author_id INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  author_is_ai BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
  audit_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 点赞表（独立，方便统计）
CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_posts_circle_id ON posts(circle_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- ============================================================
-- 初始数据：AI 帖子（静静姐姐首发帖）
-- ============================================================
INSERT INTO circles (id, name, description, age_range) VALUES
  ('primary', '作业战场', '6-9岁孩子的学习陪伴', '6-9'),
  ('middle', '秘密花园', '9-12岁孩子的成长空间', '9-12'),
  ('all', '树洞', '全年龄段家长交流区', 'all')
ON CONFLICT (id) DO NOTHING;

INSERT INTO posts (circle_id, author_id, author_name, author_is_ai, content, is_ai_generated, is_pinned, like_count, comment_count, view_count, status)
VALUES (
  'primary',
  0,
  '静静姐姐',
  TRUE,
  '🌟 今日话题：孩子做作业总是拖延怎么办？\n\n相信很多家长都有这样的困扰：孩子放学回来，总想着玩，做作业一拖再拖...\n\n试试「番茄工作法」吧！25分钟专注学习 + 5分钟休息，比硬扛效果好多啦！\n\n你家孩子有什么拖延的小妙招吗？评论区聊聊～',
  TRUE,
  TRUE,
  328,
  89,
  1520,
  'approved'
) ON CONFLICT DO NOTHING;
