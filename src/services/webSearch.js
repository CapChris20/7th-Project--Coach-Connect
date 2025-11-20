// Simple client-side web search using DuckDuckGo (no API key needed)
export async function searchWeb(query, maxResults = 3) {
  try {
    // Use DuckDuckGo Instant Answer API (free, no key required)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
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
    
    // Fallback: if no results, try HTML scraping (simple approach)
    if (results.length === 0) {
      try {
        const htmlResponse = await fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
        );
        const html = await htmlResponse.text();
        // Simple extraction (basic, but works)
        const titleMatch = html.match(/<a class="result__a"[^>]*>([^<]+)<\/a>/);
        const snippetMatch = html.match(/<a class="result__snippet"[^>]*>([^<]+)<\/a>/);
        if (titleMatch && snippetMatch) {
          results.push({
            title: titleMatch[1],
            snippet: snippetMatch[1],
            url: '#',
          });
        }
      } catch (e) {
        // Ignore HTML fallback errors
      }
    }
    
    return results;
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

// Enhanced search that formats results for GPT
export async function getWebContext(query) {
  const results = await searchWeb(query, 3);
  if (results.length === 0) return '';
  
  return `Recent web information about "${query}":\n${results
    .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
    .join('\n')}\n\nUse this information to provide accurate, up-to-date answers.`;
}


