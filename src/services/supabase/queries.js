import supabase from './config';

// Get all exercises
export const fetchExercises = async () => {
  try {
    console.log('Fetching exercises from Supabase');
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    console.log('Exercises fetched successfully:', data.length);
    return { success: true, data };
  } catch (error) {
    console.error('Fetch exercises error:', error);
    return { success: false, error: error.message };
  }
};

// Get exercises by muscle group
export const fetchExercisesByMuscle = async (muscleGroup) => {
  try {
    console.log('Fetching exercises for muscle group:', muscleGroup);
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('muscle_group', muscleGroup)
      .order('name');
    
    if (error) throw error;
    
    console.log('Muscle group exercises fetched:', data.length);
    return { success: true, data };
  } catch (error) {
    console.error('Fetch exercises by muscle error:', error);
    return { success: false, error: error.message };
  }
};

// Search exercises by name
export const searchExercises = async (searchTerm) => {
  try {
    console.log('Searching exercises for term:', searchTerm);
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', `%${searchTerm}%`)
      .order('name');
    
    if (error) throw error;
    
    console.log('Exercise search completed:', data.length, 'results');
    return { success: true, data };
  } catch (error) {
    console.error('Search exercises error:', error);
    return { success: false, error: error.message };
  }
};

// Get exercise by ID
export const fetchExerciseById = async (id) => {
  try {
    console.log('Fetching exercise by ID:', id);
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    console.log('Exercise fetched successfully:', data.name);
    return { success: true, data };
  } catch (error) {
    console.error('Fetch exercise by ID error:', error);
    return { success: false, error: error.message };
  }
};


