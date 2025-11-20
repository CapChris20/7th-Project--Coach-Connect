import axios from 'axios';

// OpenFoodFacts API configuration
const BASE_URL = 'https://world.openfoodfacts.org/api/v0';

// Create axios instance
const foodApi = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Search food by barcode
export const searchByBarcode = async (barcode) => {
  try {
    console.log('Searching food by barcode:', barcode);
    
    const response = await foodApi.get(`/product/${barcode}.json`);
    
    if (response.data.status === 1) {
      const product = response.data.product;
      const nutritionData = {
        name: product.product_name || 'Unknown Product',
        brand: product.brands || '',
        barcode: barcode,
        calories: product.nutriments?.energy_kcal_100g || 0,
        protein: product.nutriments?.proteins_100g || 0,
        carbs: product.nutriments?.carbohydrates_100g || 0,
        fat: product.nutriments?.fat_100g || 0,
        fiber: product.nutriments?.fiber_100g || 0,
        sugar: product.nutriments?.sugars_100g || 0,
        sodium: product.nutriments?.sodium_100g || 0,
        image: product.image_url || '',
        ingredients: product.ingredients_text || '',
        nutritionGrade: product.nutrition_grade_fr || '',
      };
      
      console.log('Food found by barcode:', nutritionData.name);
      return { success: true, data: nutritionData };
    } else {
      console.log('Product not found in database');
      return { success: false, error: 'Product not found' };
    }
  } catch (error) {
    console.error('Barcode search error:', error);
    return { success: false, error: error.message };
  }
};

// Search food by name
export const searchByName = async (searchTerm, limit = 20) => {
  try {
    console.log('Searching food by name:', searchTerm);
    
    const response = await foodApi.get(`/cgi/search.pl?search_terms=${encodeURIComponent(searchTerm)}&search_simple=1&action=process&json=1&page_size=${limit}`);
    
    const products = response.data.products.map(product => ({
      name: product.product_name || 'Unknown Product',
      brand: product.brands || '',
      barcode: product.code || '',
      calories: product.nutriments?.energy_kcal_100g || 0,
      protein: product.nutriments?.proteins_100g || 0,
      carbs: product.nutriments?.carbohydrates_100g || 0,
      fat: product.nutriments?.fat_100g || 0,
      image: product.image_url || '',
      nutritionGrade: product.nutrition_grade_fr || '',
    }));
    
    console.log('Food search completed:', products.length, 'results');
    return { success: true, data: products };
  } catch (error) {
    console.error('Food name search error:', error);
    return { success: false, error: error.message };
  }
};

// Get detailed nutrition information
export const getNutritionDetails = async (barcode) => {
  try {
    console.log('Getting detailed nutrition for barcode:', barcode);
    
    const response = await foodApi.get(`/product/${barcode}.json`);
    
    if (response.data.status === 1) {
      const product = response.data.product;
      const detailedNutrition = {
        basic: {
          calories: product.nutriments?.energy_kcal_100g || 0,
          protein: product.nutriments?.proteins_100g || 0,
          carbs: product.nutriments?.carbohydrates_100g || 0,
          fat: product.nutriments?.fat_100g || 0,
        },
        vitamins: {
          vitaminA: product.nutriments?.vitamin_a_100g || 0,
          vitaminC: product.nutriments?.vitamin_c_100g || 0,
          vitaminD: product.nutriments?.vitamin_d_100g || 0,
          vitaminE: product.nutriments?.vitamin_e_100g || 0,
        },
        minerals: {
          calcium: product.nutriments?.calcium_100g || 0,
          iron: product.nutriments?.iron_100g || 0,
          magnesium: product.nutriments?.magnesium_100g || 0,
          potassium: product.nutriments?.potassium_100g || 0,
        },
        other: {
          fiber: product.nutriments?.fiber_100g || 0,
          sugar: product.nutriments?.sugars_100g || 0,
          sodium: product.nutriments?.sodium_100g || 0,
          saturatedFat: product.nutriments?.saturated_fat_100g || 0,
        }
      };
      
      console.log('Detailed nutrition retrieved');
      return { success: true, data: detailedNutrition };
    } else {
      return { success: false, error: 'Product not found' };
    }
  } catch (error) {
    console.error('Get nutrition details error:', error);
    return { success: false, error: error.message };
  }
};


