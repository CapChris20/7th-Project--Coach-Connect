import axios from 'axios';
import { getApiBase } from '../../shared/services/baseUrl';
import { getApiAuthHeaders } from '../../shared/services/apiAuthHeaders';

// Resolve backend URL for server-side web search
function getBaseUrl() {
  return getApiBase();
}

// Direct DuckDuckGo search (skips server check - for fallback use)
async function searchWebDirect(query, maxResults = 3) {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    let results = [];
    
    // Get instant answer if available
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        snippet: data.AbstractText,
        url: data.AbstractURL,
      });
    }
    
    // Get related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, maxResults - results.length).forEach(topic => {
        if (topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || query,
            snippet: topic.Text,
            url: topic.FirstURL,
          });
        }
      });
    }
    
    return results;
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    throw error; // Re-throw so caller knows it failed
  }
}

// Try server-side web search first (uses Serper API if available), fallback to DuckDuckGo
export async function searchWeb(query, maxResults = 3) {
  try {
    // First, try server-side search (better for React Native, avoids CORS)
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      // No server URL configured, skip to fallback
      throw new Error('Server URL not configured');
    }
    try {
      // Check if server is available by making a test request
      const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
      if (!headers.Authorization) throw new Error('Not signed in');
      const serverResponse = await axios.post(
        `${baseUrl}/api/ask`,
        {
          messages: [{ role: 'user', content: query }],
          enableWeb: true,
        },
        {
          headers,
          timeout: 10000
        }
      );
      
      // If server has web search results, parse them
      if (serverResponse.data?.usedWeb && serverResponse.data?.raw) {
        // Extract web context from the response if available
        // The server already includes web context in the response
        return [{
          title: 'Web Search Results',
          snippet: 'Web search was performed server-side',
          url: '#',
        }];
      }
    } catch (serverError) {
      // Server not available or error - fallback to client-side
      const errorMsg = serverError?.message || serverError?.code || 'Unknown error';
      console.log('Server-side web search unavailable, using client-side fallback:', errorMsg);
      console.log('💡 To enable web search:');
      console.log('   1. Make sure the server is running: cd server && npm start');
      console.log('   2. For web: Set EXPO_PUBLIC_API_BASE_URL in .env to your deployed server URL');
      console.log('   3. Check that SERPER_API_KEY is set in server/.env or root .env');
    }

    // Fallback: Use DuckDuckGo Instant Answer API (may have CORS issues in React Native)
    try {
      return await searchWebDirect(query, maxResults);
    } catch (duckDuckGoError) {
      console.error('DuckDuckGo search error:', duckDuckGoError);
      // Return empty results if both methods fail
      return [];
    }
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

// Enhanced search that formats results for GPT
// Prefers server-side search (Serper API) if available, falls back to client-side
export async function getWebContext(query) {
  console.log(`🔍 [WEB SEARCH] getWebContext() called for query: "${query.substring(0, 50)}..."`);
  try {
    // First, try server-side search (better for React Native, uses Serper API)
    console.log('🌐 [WEB SEARCH] Attempting server-side search (Serper API)...');
    const baseUrl = getBaseUrl();
    if (baseUrl) {
      try {
        // Try to get web context via the /api/ask endpoint (requires OpenAI key)
        const apiKey = getOpenAIKey?.() || undefined;
        const serverResponse = await axios.post(
          `${baseUrl}/api/ask`,
          {
            messages: [{ role: 'user', content: query }],
            enableWeb: true,
          },
          {
            headers: apiKey ? { 'x-openai-key': apiKey } : undefined,
            timeout: 10000
          }
        );
        
        // Server includes web context in the response if SERPER_API_KEY is set
        if (serverResponse.data?.usedWeb) {
          if (serverResponse.data?.webNotes) {
            console.log('✅ [WEB SEARCH] SERPER API USED - Web notes retrieved from server');
            console.log(`📝 [WEB SEARCH] Found ${serverResponse.data.webNotes.length} web search results`);
            // Extract actual web search results from server response
            const webNotes = serverResponse.data.webNotes;
            return `Recent web information about "${query}":\n\n${webNotes.join('\n\n')}\n\nUse this information to provide accurate, up-to-date answers.`;
          } else {
            console.log('✅ [WEB SEARCH] SERPER API USED - Web search performed (notes not included in response)');
            // Web search was used but notes not included (fallback)
            return `Recent web information about "${query}":\nWeb search was performed and results are included in the context.\n\nUse this information to provide accurate, up-to-date answers.`;
          }
        } else {
          console.log('⚠️ [WEB SEARCH] Server responded but web search was not used (usedWeb=false)');
        }
      } catch (serverError) {
        // Server not available or error - fallback to client-side
        const errorMsg = serverError?.message || serverError?.code || 'Unknown error';
        console.log('Server-side web search unavailable, using client-side fallback:', errorMsg);
        console.log('💡 To enable web search:');
        console.log('   1. Make sure the server is running: cd server && npm start');
        console.log('   2. For web: Set EXPO_PUBLIC_API_BASE_URL in .env to your deployed server URL');
        console.log('   3. Check that SERPER_API_KEY is set in server/.env or root .env');
      }
    }

    // Fallback: Use client-side search (DuckDuckGo) - skip server check since it already failed
    console.log('🦆 [WEB SEARCH] Falling back to DuckDuckGo client-side search (Serper not available)');
    try {
      const results = await searchWebDirect(query, 5); // Increase to 5 results
      if (results.length === 0) {
        // Try alternative search approach - use a simpler query
        try {
          const simpleQuery = query.split(' ').slice(0, 5).join(' '); // First 5 words
          const altResults = await searchWebDirect(simpleQuery, 3);
          if (altResults.length > 0) {
            console.log(`✅ [WEB SEARCH] DuckDuckGo search successful (simplified query) - Found ${altResults.length} results`);
            return `Recent web information about "${query}":\n${altResults
              .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
              .join('\n')}\n\nUse this information to provide accurate, up-to-date answers.`;
          }
        } catch (altErr) {
          console.warn('Alternative search also failed:', altErr);
        }
        console.log('⚠️ [WEB SEARCH] No web search results found - proceeding without web context');
        return '';
      }
      
      console.log(`✅ [WEB SEARCH] DuckDuckGo search successful - Found ${results.length} results`);
      return `Recent web information about "${query}":\n${results
        .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
        .join('\n')}\n\nUse this information to provide accurate, up-to-date answers.`;
    } catch (duckDuckGoError) {
      console.error('⚠️ [WEB SEARCH] DuckDuckGo fallback also failed:', duckDuckGoError?.message || duckDuckGoError);
      console.log('⚠️ [WEB SEARCH] No web search results found - proceeding without web context');
      return '';
    }
  } catch (error) {
    console.error('getWebContext error:', error);
    return '';
  }
}

