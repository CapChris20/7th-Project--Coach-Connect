import axios from 'axios';
import Constants from 'expo-constants';

// ExerciseDB API configuration
const API_KEY = Constants.expoConfig?.extra?.exerciseDbApiKey || process.env.EXPO_PUBLIC_EXERCISEDB_API_KEY;
const BASE_URL = 'https://exercisedb.p.rapidapi.com';

// Create axios instance with headers
const exerciseApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-RapidAPI-Key': API_KEY,
    'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Rate limiting
let lastRequestTime = 0;
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

const rateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const delay = RATE_LIMIT_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  lastRequestTime = Date.now();
};

// Fetch all exercises
export const fetchExercises = async (limit = 50) => {
  try {
    await rateLimit();
    console.log('Fetching exercises from ExerciseDB');
    
    const response = await exerciseApi.get(`/exercises?limit=${limit}`);
    console.log('Exercises fetched successfully:', response.data.length);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Fetch exercises error:', error);
    return { success: false, error: error.message };
  }
};

// Fetch exercises by muscle group
export const fetchByMuscle = async (muscleGroup, limit = 20) => {
  try {
    await rateLimit();
    console.log('Fetching exercises for muscle group:', muscleGroup);
    
    const response = await exerciseApi.get(`/exercises/bodyPart/${muscleGroup}?limit=${limit}`);
    console.log('Muscle group exercises fetched:', response.data.length);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Fetch exercises by muscle error:', error);
    return { success: false, error: error.message };
  }
};

// Search exercises by name
export const searchExercises = async (searchTerm, limit = 10) => {
  try {
    await rateLimit();
    console.log('Searching exercises for term:', searchTerm);
    
    const response = await exerciseApi.get(`/exercises/name/${searchTerm}?limit=${limit}`);
    console.log('Exercise search completed:', response.data.length, 'results');
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Search exercises error:', error);
    return { success: false, error: error.message };
  }
};

// Get exercise by ID
export const fetchExerciseById = async (id) => {
  try {
    await rateLimit();
    console.log('Fetching exercise by ID:', id);
    
    const response = await exerciseApi.get(`/exercises/exercise/${id}`);
    console.log('Exercise fetched successfully:', response.data.name);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Fetch exercise by ID error:', error);
    return { success: false, error: error.message };
  }
};


