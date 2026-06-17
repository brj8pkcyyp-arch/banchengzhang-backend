// POST /api/community/post/[id]/like - 点赞/取消点赞
import sql from '../../../../../lib/db';

async function toggleLike(req, res, postId) {
  // 检查帖子是否存在
  const posts = await sql`SELECT id, like_count FROM posts WHERE id = ${postId}`;
  if (!posts.length) {
    return res.status(200).json({ code: 404, message: '帖子不存在' });
  }

  // 检查是否已点赞
  const existing = await sql`
    SELECT id FROM likes WHERE post_id = ${postId} AND user_id = 0
  `;

  let liked;
  if (existing.length) {
    // 取消点赞
    await sql`DELETE FROM likes WHERE post_id = ${postId} AND user_id = 0`;
    await sql`UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = ${postId}`;
    liked = false;
  } else {
    // 点赞
    await sql`INSERT INTO likes (post_id, user_id) VALUES (${postId}, 0)`;
    await sql`UPDATE posts SET like_count = like_count + 1 WHERE id = ${postId}`;
    liked = true;
  }

  // 获取最新点赞数
  const updated = await sql`SELECT like_count FROM posts WHERE id = ${postId}`;

  return res.status(200).json({
    code: 0,
    data: { liked, likeCount: updated[0].like_count },
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
    return toggleLike(req, res, postId);
  } catch (e) {
    console.error('[/api/community/post/:id/like]', e);
    return res.status(500).json({ code: 500, message: '服务器错误', error: e.message });
  }
}
