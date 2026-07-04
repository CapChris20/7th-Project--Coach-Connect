/** Trainer marketplace CRUD (Lovable legacy) */
const admin = require('firebase-admin');
const { assertTrainerSelf } = require('../lib/marketplaceAuth');

function registerMarketplaceRoutes(app, deps = {}) {
  const { verifyFirebaseBearerToken } = deps;
  if (!verifyFirebaseBearerToken) {
    throw new Error('registerMarketplaceRoutes requires verifyFirebaseBearerToken');
  }

  // Get all trainers with filtering and sorting
  app.get('/api/trainers', async (req, res) => {
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

      // Apply filters
      if (specialty) {
        trainersQuery = trainersQuery.where('specialties', 'array-contains', specialty);
      }

      if (minRating) {
        trainersQuery = trainersQuery.where('rating', '>=', parseFloat(minRating));
      }

      // Execute query
      const snapshot = await trainersQuery.get();
      let trainers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        trainers = trainers.filter(
          (trainer) =>
            trainer.name?.toLowerCase().includes(searchLower) ||
            trainer.specialties?.some((s) => s.toLowerCase().includes(searchLower)) ||
            trainer.location?.toLowerCase().includes(searchLower),
        );
      }

      // Apply sorting
      trainers.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit, 10);
      const paginatedTrainers = trainers.slice(startIndex, endIndex);

      res.json({
        trainers: paginatedTrainers,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: trainers.length,
          pages: Math.ceil(trainers.length / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching trainers:', error);
      res.status(500).json({ error: 'Failed to fetch trainers' });
    }
  });

  // Get single trainer by ID
  app.get('/api/trainers/:id', async (req, res) => {
    try {
      const db = admin.firestore();
      const trainerDoc = await db.collection('trainers').doc(req.params.id).get();

      if (!trainerDoc.exists) {
        return res.status(404).json({ error: 'Trainer not found' });
      }

      res.json({
        id: trainerDoc.id,
        ...trainerDoc.data(),
      });
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
        ...req.body,
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

      res.json({
        id: saved.id,
        ...saved.data(),
      });
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
        ...req.body,
        uid: auth.requesterUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await trainerRef.set(updateData, { merge: true });

      const updatedTrainer = await trainerRef.get();
      res.json({
        id: updatedTrainer.id,
        ...updatedTrainer.data(),
      });
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

  // Get trainer specialties for filters
  app.get('/api/specialties', async (req, res) => {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection('trainers').get();

      const allSpecialties = new Set();
      snapshot.docs.forEach((doc) => {
        const specialties = doc.data().specialties || [];
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

  // Sample data endpoint for Lovable testing
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
}

module.exports = { registerMarketplaceRoutes };
