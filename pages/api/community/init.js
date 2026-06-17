// POST /api/community/init - 初始化数据库 Schema（仅首次使用）
// 警告：生产环境请勿随意执行，会插入初始数据
import sql from '../../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 405, message: '只支持 POST' });
  }

  try {
    // 建表：圈子
    await sql`
      CREATE TABLE IF NOT EXISTS circles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        age_range TEXT
      )
    `;

    // 建表：用户（简化版）
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nickname TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 建表：帖子
    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        circle_id TEXT NOT NULL DEFAULT 'primary',
        author_id INTEGER NOT NULL DEFAULT 0,
        author_name TEXT NOT NULL,
        author_is_ai BOOLEAN DEFAULT FALSE,
        content TEXT NOT NULL,
        is_ai_generated BOOLEAN DEFAULT FALSE,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_featured BOOLEAN DEFAULT FALSE,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'approved',
        audit_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 建表：评论
    await sql`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL DEFAULT 0,
        author_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 建表：点赞
    await sql`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(post_id, user_id)
      )
    `;

    // 插入初始数据
    await sql`INSERT INTO circles (id, name, description, age_range) VALUES
      ('primary', '作业战场', '6-9岁孩子的学习陪伴', '6-9'),
      ('middle', '秘密花园', '9-12岁孩子的成长空间', '9-12'),
      ('all', '树洞', '全年龄段家长交流区', 'all')
      ON CONFLICT (id) DO NOTHING`;

    await sql`INSERT INTO posts (circle_id, author_id, author_name, author_is_ai, content, is_ai_generated, is_pinned, like_count, comment_count, view_count, status)
      VALUES ('primary', 0, '静静姐姐', TRUE,
        '🌟 今日话题：孩子做作业总是拖延怎么办？\n\n相信很多家长都有这样的困扰：孩子放学回来，总想着玩，做作业一拖再拖...\n\n试试「番茄工作法」吧！25分钟专注学习 + 5分钟休息，比硬扛效果好多啦！\n\n你家孩子有什么拖延的小妙招吗？评论区聊聊～',
        TRUE, TRUE, 328, 89, 1520, 'approved')
      ON CONFLICT DO NOTHING`;

    return res.status(200).json({ code: 0, message: '数据库初始化成功！社区正式上线。' });

  } catch (e) {
    console.error('[/api/community/init]', e);
    return res.status(500).json({ code: 500, message: '初始化失败', error: e.message });
  }
}
