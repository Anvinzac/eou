export async function withFallback<T>(
  queryPromise: PromiseLike<{ data: T | null; error: any }>,
  fallbackData: T
): Promise<{ data: T; error: any }> {
  try {
    const response = await queryPromise;
    
    // If there is an error from Supabase, or data is explicitly null
    if (response.error || !response.data) {
      console.warn('Supabase query failed or returned no data. Using fallback data.', response.error);
      return { data: fallbackData, error: response.error };
    }
    
    // If the data is an empty array, and we want to ensure "there's always something to display"
    // we can use the fallback data if it's provided and not empty.
    if (Array.isArray(response.data) && response.data.length === 0 && Array.isArray(fallbackData) && fallbackData.length > 0) {
      console.warn('Supabase query returned empty array. Using fallback data to ensure content is displayed.');
      return { data: fallbackData, error: null };
    }

    return { data: response.data, error: null };
  } catch (error) {
    console.error('Exception during Supabase query. Using fallback data.', error);
    return { data: fallbackData, error };
  }
}
