// GET    /api/community/post/[id] - 获取单个帖子
// PUT    /api/community/post/[id] - 编辑帖子
// DELETE /api/community/post/[id] - 删除帖子
import sql from '../../../../lib/db';

async function getPost(req, res, postId) {
  const rows = await sql`
    SELECT p.*,
           CASE WHEN l.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked
    FROM posts p
    LEFT JOIN likes l ON p.id = l.post_id AND l.user_id = 0
    WHERE p.id = ${postId} AND p.status = 'approved'
  `;

  if (!rows.length) {
    return res.status(404).json({ code: 404, message: '帖子不存在' });
  }

  // 更新浏览数
  await sql`UPDATE posts SET view_count = view_count + 1 WHERE id = ${postId}`;

  return res.status(200).json({ code: 0, data: formatPost(rows[0]) });
}

async function editPost(req, res, postId) {
  const { content, authorName } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ code: 400, message: '内容不能为空' });
  }

  const rows = await sql`
    UPDATE posts SET content = ${content.trim()}, updated_at = NOW()
    WHERE id = ${postId}
    RETURNING *
  `;

  if (!rows.length) {
    return res.status(404).json({ code: 404, message: '帖子不存在' });
  }

  return res.status(200).json({ code: 0, data: formatPost(rows[0]) });
}

async function deletePost(req, res, postId) {
  const rows = await sql`
    DELETE FROM posts WHERE id = ${postId} RETURNING id
  `;

  if (!rows.length) {
    return res.status(404).json({ code: 404, message: '帖子不存在' });
  }

  return res.status(200).json({ code: 0, message: '删除成功' });
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const postId = parseInt(id);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ code: 400, message: '无效的帖子ID' });
  }

  try {
    if (req.method === 'GET') {
      return getPost(req, res, postId);
    } else if (req.method === 'PUT') {
      return editPost(req, res, postId);
    } else if (req.method === 'DELETE') {
      return deletePost(req, res, postId);
    } else {
      return res.status(405).json({ code: 405, message: '不支持该方法' });
    }
  } catch (e) {
    console.error('[/api/community/post/:id]', e);
    return res.status(500).json({ code: 500, message: '服务器错误', error: e.message });
  }
}
