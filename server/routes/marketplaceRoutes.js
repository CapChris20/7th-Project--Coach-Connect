/** Trainer marketplace CRUD (Lovable legacy) */
const admin = require('firebase-admin');
const {
  assertTrainerSelf,
  toPublicTrainerProfile,
  pickWritableTrainerFields,
} = require('../lib/marketplaceAuth');

function registerMarketplaceRoutes(app, deps = {}) {
  const { verifyFirebaseBearerToken } = deps;
  if (!verifyFirebaseBearerToken) {
    throw new Error('registerMarketplaceRoutes requires verifyFirebaseBearerToken');
  }

  // Sample data endpoint for Lovable testing (static — no auth, no Admin SDK)
  app.get('/api/trainers/sample', (req, res) => {
    res.json({
      trainers: [
        {
          id: 'sample1',
          name: 'John Smith',
          location: 'Detroit, MI',
          specialties: ['strength', 'weight_loss'],
          bio: '10 years experience helping clients reach their fitness goals through personalized training programs.',
          rating: 4.8,
          reviews: 25,
          clients: 15,
          sessions: 150,
          certifications: ['NASM', 'ACE'],
          yearsExperience: 10,
          rate: 75,
          available: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'sample2',
          name: 'Sarah Johnson',
          location: 'Los Angeles, CA',
          specialties: ['yoga', 'rehabilitation', 'senior'],
          bio: 'Specializing in gentle yoga and rehabilitation exercises for all ages and fitness levels.',
          rating: 4.9,
          reviews: 42,
          clients: 28,
          sessions: 200,
          certifications: ['Yoga Alliance', 'NSCA'],
          yearsExperience: 8,
          rate: 85,
          available: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'sample3',
          name: 'Mike Chen',
          location: 'New York, NY',
          specialties: ['crossfit', 'powerlifting', 'athletic'],
          bio: 'Former competitive athlete helping clients achieve peak performance through strength and conditioning.',
          rating: 4.7,
          reviews: 18,
          clients: 12,
          sessions: 89,
          certifications: ['CrossFit Level 3', 'NSCA-CSCS'],
          yearsExperience: 6,
          rate: 90,
          available: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 10, total: 3, pages: 1 },
    });
  });

  // Sample specialties endpoint
  app.get('/api/specialties/sample', (req, res) => {
    res.json({
      specialties: [
        'strength',
        'weight_loss',
        'yoga',
        'rehabilitation',
        'crossfit',
        'powerlifting',
        'athletic',
        'senior',
        'bodybuilding',
      ],
    });
  });

  // Get all trainers with filtering and sorting (auth required; public fields only)
  app.get('/api/trainers', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const db = admin.firestore();
      const {
        page = 1,
        limit = 10,
        specialty,
        minRating,
        sortBy = 'rating',
        sortOrder = 'desc',
        search,
      } = req.query;

      let trainersQuery = db.collection('trainers').where('available', '==', true);

      if (specialty) {
        trainersQuery = trainersQuery.where('specialties', 'array-contains', specialty);
      }

      if (minRating) {
        trainersQuery = trainersQuery.where('rating', '>=', parseFloat(minRating));
      }

      const snapshot = await trainersQuery.get();
      let trainers = snapshot.docs.map((docSnap) => toPublicTrainerProfile(docSnap.id, docSnap.data()));

      if (search) {
        const searchLower = String(search).toLowerCase();
        trainers = trainers.filter(
          (trainer) =>
            trainer.name?.toLowerCase().includes(searchLower) ||
            trainer.specialties?.some((s) => String(s).toLowerCase().includes(searchLower)) ||
            trainer.location?.toLowerCase().includes(searchLower),
        );
      }

      const allowedSort = new Set(['rating', 'reviews', 'clients', 'sessions', 'rate', 'price', 'name']);
      const sortKey = allowedSort.has(String(sortBy)) ? String(sortBy) : 'rating';
      trainers.sort((a, b) => {
        const aVal = a[sortKey] || 0;
        const bVal = b[sortKey] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedTrainers = trainers.slice(startIndex, startIndex + limitNum);

      res.json({
        trainers: paginatedTrainers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: trainers.length,
          pages: Math.ceil(trainers.length / limitNum) || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching trainers:', error);
      res.status(500).json({ error: 'Failed to fetch trainers' });
    }
  });

  // Get single trainer by ID (auth required; public fields only)
  app.get('/api/trainers/:id', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const db = admin.firestore();
      const trainerDoc = await db.collection('trainers').doc(req.params.id).get();

      if (!trainerDoc.exists) {
        return res.status(404).json({ error: 'Trainer not found' });
      }

      res.json(toPublicTrainerProfile(trainerDoc.id, trainerDoc.data()));
    } catch (error) {
      console.error('Error fetching trainer:', error);
      res.status(500).json({ error: 'Failed to fetch trainer' });
    }
  });

  // Create trainer profile (trainer may only create own doc keyed by uid)
  app.post('/api/trainers', verifyFirebaseBearerToken, async (req, res) => {
    const auth = assertTrainerSelf(req, req.firebaseAuth?.uid);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    try {
      const db = admin.firestore();
      const trainerData = {
        ...pickWritableTrainerFields(req.body),
        uid: auth.requesterUid,
        available: true,
        rating: 0,
        reviews: 0,
        clients: 0,
        sessions: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const trainerRef = db.collection('trainers').doc(auth.requesterUid);
      await trainerRef.set(trainerData, { merge: true });
      const saved = await trainerRef.get();

      res.json(toPublicTrainerProfile(saved.id, saved.data()));
    } catch (error) {
      console.error('Error creating trainer:', error);
      res.status(500).json({ error: 'Failed to create trainer' });
    }
  });

  // Update trainer
  app.put('/api/trainers/:id', verifyFirebaseBearerToken, async (req, res) => {
    const auth = assertTrainerSelf(req, req.params.id);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    try {
      const db = admin.firestore();
      const trainerRef = db.collection('trainers').doc(auth.targetId);

      const updateData = {
        ...pickWritableTrainerFields(req.body),
        uid: auth.requesterUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await trainerRef.set(updateData, { merge: true });

      const updatedTrainer = await trainerRef.get();
      res.json(toPublicTrainerProfile(updatedTrainer.id, updatedTrainer.data()));
    } catch (error) {
      console.error('Error updating trainer:', error);
      res.status(500).json({ error: 'Failed to update trainer' });
    }
  });

  // Delete trainer
  app.delete('/api/trainers/:id', verifyFirebaseBearerToken, async (req, res) => {
    const auth = assertTrainerSelf(req, req.params.id);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    try {
      const db = admin.firestore();
      await db.collection('trainers').doc(auth.targetId).delete();

      res.json({ message: 'Trainer deleted successfully' });
    } catch (error) {
      console.error('Error deleting trainer:', error);
      res.status(500).json({ error: 'Failed to delete trainer' });
    }
  });

  // Get trainer specialties for filters (auth required; specialties list only)
  app.get('/api/specialties', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection('trainers').where('available', '==', true).get();

      const allSpecialties = new Set();
      snapshot.docs.forEach((docSnap) => {
        const specialties = docSnap.data().specialties || [];
        specialties.forEach((specialty) => allSpecialties.add(specialty));
      });

      res.json({
        specialties: Array.from(allSpecialties).sort(),
      });
    } catch (error) {
      console.error('Error fetching specialties:', error);
      res.status(500).json({ error: 'Failed to fetch specialties' });
    }
  });
}

module.exports = { registerMarketplaceRoutes };
