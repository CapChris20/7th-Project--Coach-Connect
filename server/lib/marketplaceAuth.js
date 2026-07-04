/**
 * Marketplace trainer profile write authorization.
 */
function getRequesterUid(req) {
  return String(req.firebaseAuth?.uid || '').trim();
}

function assertTrainerSelf(req, trainerId) {
  const requesterUid = getRequesterUid(req);
  const targetId = String(trainerId || '').trim();
  if (!requesterUid) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!targetId) {
    return { ok: false, status: 400, error: 'Trainer id is required' };
  }
  if (requesterUid !== targetId) {
    return { ok: false, status: 403, error: 'Cannot modify other trainer profiles' };
  }
  return { ok: true, requesterUid, targetId };
}

module.exports = {
  getRequesterUid,
  assertTrainerSelf,
};
