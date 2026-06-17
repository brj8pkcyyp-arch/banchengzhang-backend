// GET /api/community/post/[id]/comments - 获取帖子评论列表
import sql from '../../../../../lib/db';

async function getComments(req, res, postId) {
  const rows = await sql`
    SELECT * FROM comments
    WHERE post_id = ${postId}
    ORDER BY created_at ASC
  `;

  return res.status(200).json({
    code: 0,
    data: rows.map(row => ({
      id: row.id,
      postId: row.post_id,
      author: { id: row.author_id, name: row.author_name },
      content: row.content,
      createdAt: row.created_at,
    })),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 405, message: '只支持 GET' });
  }

  const { id } = req.query;
  const postId = parseInt(id);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ code: 400, message: '无效的帖子ID' });
  }

  try {
    return getComments(req, res, postId);
  } catch (e) {
    console.error('[/api/community/post/:id/comments]', e);
    return res.status(500).json({ code: 500, message: '服务器错误', error: e.message });
  }
}
