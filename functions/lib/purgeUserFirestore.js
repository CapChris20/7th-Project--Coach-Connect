/**
 * Paginated Firestore purge for account deletion — no hard doc limits.
 */

const PAGE_SIZE = 100;

async function deleteQueryPage(db, queryRef) {
  const snap = await queryRef.limit(PAGE_SIZE).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function deleteAllMatching(db, buildQuery) {
  let total = 0;
  let deleted = PAGE_SIZE;
  while (deleted >= PAGE_SIZE) {
    deleted = await deleteQueryPage(db, buildQuery());
    total += deleted;
  }
  return total;
}

async function purgeConversationMessages(db, convDocId) {
  let deleted = PAGE_SIZE;
  while (deleted >= PAGE_SIZE) {
    deleted = await deleteQueryPage(
      db,
      db.collection('messages').where('conversationId', '==', convDocId),
    );
  }
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 */
async function purgeUserFirestore(db, uid) {
  if (!uid || !db) return;

  const userRef = db.collection('users').doc(uid);
  await db.recursiveDelete(userRef);

  try {
    await db.collection('trainers').doc(uid).delete();
  } catch (_) {
    /* ignore */
  }

  // Conversations + messages (paginated)
  let convDeleted = PAGE_SIZE;
  while (convDeleted >= PAGE_SIZE) {
    const convSnap = await db
      .collection('conversations')
      .where('participants', 'array-contains', uid)
      .limit(PAGE_SIZE)
      .get();
    if (convSnap.empty) break;
    for (const convDoc of convSnap.docs) {
      await purgeConversationMessages(db, convDoc.id);
      await convDoc.ref.delete();
    }
    convDeleted = convSnap.size;
  }

  // Trainer's own CRM subtree
  const asTrainer = await db.collection('trainer_clients').doc(uid).listCollections();
  for (const sub of asTrainer) {
    await deleteAllMatching(db, () => sub);
  }
  await db.collection('trainer_clients').doc(uid).delete().catch(() => {});

  // Orphan CRM rows on other trainers' rosters (client doc id === uid)
  await deleteAllMatching(db, () =>
    db.collectionGroup('clients').where('clientId', '==', uid),
  );

  // Also delete by document id path when clientId field is absent
  const linkSnap = await db
    .collection('trainer_client_links')
    .where('clientId', '==', uid)
    .get();
  for (const linkDoc of linkSnap.docs) {
    const data = linkDoc.data() || {};
    const trainerId = String(data.trainerId || '').trim();
    if (trainerId) {
      await db
        .collection('trainer_clients')
        .doc(trainerId)
        .collection('clients')
        .doc(uid)
        .delete()
        .catch(() => {});
    }
  }

  // trainer_client_links where user is client (paginated)
  await deleteAllMatching(db, () =>
    db.collection('trainer_client_links').where('clientId', '==', uid),
  );

  // trainer_client_links where user is trainer — clear client users.trainerId first
  let trainerLinkDeleted = PAGE_SIZE;
  while (trainerLinkDeleted >= PAGE_SIZE) {
    const trainerLinks = await db
      .collection('trainer_client_links')
      .where('trainerId', '==', uid)
      .limit(PAGE_SIZE)
      .get();
    if (trainerLinks.empty) break;
    const batch = db.batch();
    for (const linkDoc of trainerLinks.docs) {
      const clientId = String((linkDoc.data() || {}).clientId || '').trim();
      if (clientId) {
        batch.set(
          db.collection('users').doc(clientId),
          { trainerId: null },
          { merge: true },
        );
      }
      batch.delete(linkDoc.ref);
    }
    await batch.commit();
    trainerLinkDeleted = trainerLinks.size;
  }
}

module.exports = { purgeUserFirestore, PAGE_SIZE, deleteQueryPage, deleteAllMatching };
