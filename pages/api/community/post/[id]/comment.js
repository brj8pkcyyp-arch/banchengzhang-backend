// POST /api/community/post/[id]/comment - 发评论
import sql from '../../../../../lib/db';

async function createComment(req, res, postId) {
  const { content, authorName = '家长', authorId = null } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ code: 400, message: '评论内容不能为空' });
  }

  // 检查帖子是否存在
  const posts = await sql`SELECT id FROM posts WHERE id = ${postId}`;
  if (!posts.length) {
    return res.status(200).json({ code: 404, message: '帖子不存在', data: null });
  }

  // 内容安全检查
  const dangerous = [/自杀|自残|割腕|上吊/i, /虐待|家暴|殴打/i, /性侵|猥亵/i];
  for (const pattern of dangerous) {
    if (pattern.test(content)) {
      return res.status(200).json({ code: 403, message: '评论内容包含敏感词' });
    }
  }

  // 插入评论
  const result = await sql`
    INSERT INTO comments (post_id, author_id, author_name, content)
    VALUES (${postId}, ${authorId || 0}, ${authorName}, ${content.trim()})
    RETURNING *
  `;

  // 更新帖子评论数
  await sql`UPDATE posts SET comment_count = comment_count + 1 WHERE id = ${postId}`;

  const row = result[0];
  return res.status(200).json({
    code: 0,
    data: {
      id: row.id,
      postId: row.post_id,
      author: { id: row.author_id, name: row.author_name },
      content: row.content,
      createdAt: row.created_at,
    },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 405, message: '只支持 POST' });
  }

  const { id } = req.query;
  const postId = parseInt(id);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ code: 400, message: '无效的帖子ID' });
  }

  try {
    return createComment(req, res, postId);
  } catch (e) {
    console.error('[/api/community/post/:id/comment]', e);
    return res.status(500).json({ code: 500, message: '服务器错误', error: e.message });
  }
}
