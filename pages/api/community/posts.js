// GET  /api/community/posts     - 获取帖子列表
// POST /api/community/posts     - 发帖
import sql from '../../../lib/db';

// GET: 获取帖子列表
async function getPosts(req, res) {
  const { circleId, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let query = `
    SELECT p.*,
           CASE WHEN l.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked
    FROM posts p
    LEFT JOIN likes l ON p.id = l.post_id AND l.user_id = 0
    WHERE p.status = 'approved'
  `;
  const params = [];

  if (circleId) {
    params.push(circleId);
    query += ` AND p.circle_id = $${params.length}`;
  }

  query += ` ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(pageSize), offset);

  const posts = await sql(query.replace('l.user_id = 0', 'l.user_id = $1'), [0, ...params.slice(0, -2), params[params.length - 2], params[params.length - 1]]);

  return res.status(200).json({
    code: 0,
    data: {
      list: posts.map(formatPost),
      total: posts.length,
      hasMore: posts.length === parseInt(pageSize),
    },
  });
}

// POST: 发帖
async function createPost(req, res) {
  const { content, circleId = 'primary', authorName = '家长', authorId = null } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ code: 400, message: '内容不能为空' });
  }

  // 内容安全检查（简化版）
  const dangerous = [/自杀|自残|割腕|上吊/i, /虐待|家暴|殴打/i, /性侵|猥亵/i];
  for (const pattern of dangerous) {
    if (pattern.test(content)) {
      return res.status(200).json({
        code: 0,
        data: { post: null, auditStatus: 'rejected', reason: '内容包含敏感词' },
      });
    }
  }

  const result = await sql`
    INSERT INTO posts (circle_id, author_id, author_name, content, status)
    VALUES (${circleId}, ${authorId || 0}, ${authorName}, ${content.trim()}, 'approved')
    RETURNING *
  `;

  return res.status(200).json({
    code: 0,
    data: { post: formatPost(result[0]), auditStatus: 'approved' },
  });
}

function formatPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    circleId: row.circle_id,
    author: { id: row.author_id, name: row.author_name, isAI: row.author_is_ai },
    content: row.content,
    isAIGenerated: row.is_ai_generated,
    isPinned: row.is_pinned,
    isFeatured: row.is_featured,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    viewCount: row.view_count,
    status: row.status,
    isLiked: row.is_liked || false,
    createdAt: row.created_at,
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return getPosts(req, res);
    } else if (req.method === 'POST') {
      return createPost(req, res);
    } else {
      return res.status(405).json({ code: 405, message: '不支持该请求方法' });
    }
  } catch (e) {
    console.error('[/api/community/posts]', e);
    return res.status(500).json({ code: 500, message: '服务器错误', error: e.message });
  }
}
