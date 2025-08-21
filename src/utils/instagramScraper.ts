/**
 * Scraper intelligent pour récupérer les photos Instagram publiques
 */

interface InstagramPost {
  id: string;
  image_url: string;
  caption?: string;
  permalink: string;
  timestamp: string;
  likes?: number;
}

interface InstagramProfile {
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

/**
 * Récupère les posts Instagram depuis un profil public
 */
export async function scrapeInstagramProfile(username: string): Promise<{
  profile: InstagramProfile | null;
  posts: InstagramPost[];
}> {
  try {
    // Vérifier le cache local d'abord
    const cached = getCachedInstagramData(username);
    if (cached) {
      return cached;
    }

    // Essayer plusieurs méthodes de scraping
    const result = await fetchInstagramData(username);
    
    if (result.posts.length > 0) {
      // Mettre en cache pour 30 minutes
      setCachedInstagramData(username, result);
    }
    
    return result;
    
  } catch (error) {
    console.warn('Erreur lors du scraping Instagram:', error);
    return getFallbackInstagramData(username);
  }
}

/**
 * Récupère les données Instagram via différentes méthodes
 */
async function fetchInstagramData(username: string): Promise<{
  profile: InstagramProfile | null;
  posts: InstagramPost[];
}> {
  // Méthode 1: Essayer l'endpoint public Instagram
  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(profileUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const data = await response.json();
      return parseInstagramHTML(data.contents, username);
    }
  } catch (error) {
    console.warn('Méthode 1 échouée:', error);
  }

  // Méthode 2: Essayer un autre proxy
  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    const corsProxy = `https://cors-anywhere.herokuapp.com/${profileUrl}`;
    
    const response = await fetch(corsProxy);
    if (response.ok) {
      const html = await response.text();
      return parseInstagramHTML(html, username);
    }
  } catch (error) {
    console.warn('Méthode 2 échouée:', error);
  }

  // Méthode 3: API tierce (si disponible)
  try {
    // Certaines APIs publiques permettent de récupérer des données Instagram
    const apiUrl = `https://instagram-scraper-api.herokuapp.com/profile/${username}`;
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const data = await response.json();
      return formatInstagramApiData(data);
    }
  } catch (error) {
    console.warn('Méthode 3 échouée:', error);
  }

  // Si tout échoue, utiliser les données de fallback
  return getFallbackInstagramData(username);
}

/**
 * Parse le HTML d'Instagram pour extraire les données
 */
function parseInstagramHTML(html: string, username: string): {
  profile: InstagramProfile | null;
  posts: InstagramPost[];
} {
  try {
    // Chercher les données JSON dans le HTML
    const scriptRegex = /window\._sharedData\s*=\s*({.+?});/;
    const match = html.match(scriptRegex);
    
    if (match) {
      const sharedData = JSON.parse(match[1]);
      const profileData = sharedData.entry_data?.ProfilePage?.[0]?.graphql?.user;
      
      if (profileData) {
        const profile: InstagramProfile = {
          username: profileData.username,
          full_name: profileData.full_name,
          biography: profileData.biography,
          profile_pic_url: profileData.profile_pic_url,
          followers_count: profileData.edge_followed_by?.count || 0,
          following_count: profileData.edge_follow?.count || 0,
          posts_count: profileData.edge_owner_to_timeline_media?.count || 0
        };

        const posts: InstagramPost[] = profileData.edge_owner_to_timeline_media?.edges?.map((edge: any) => ({
          id: edge.node.id,
          image_url: edge.node.display_url,
          caption: edge.node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
          permalink: `https://www.instagram.com/p/${edge.node.shortcode}/`,
          timestamp: new Date(edge.node.taken_at_timestamp * 1000).toISOString(),
          likes: edge.node.edge_liked_by?.count || 0
        })) || [];

        return { profile, posts: posts.slice(0, 12) }; // Limiter à 12 posts
      }
    }
  } catch (error) {
    console.warn('Erreur parsing HTML Instagram:', error);
  }

  return { profile: null, posts: [] };
}

/**
 * Formate les données d'une API tierce
 */
function formatInstagramApiData(data: any): {
  profile: InstagramProfile | null;
  posts: InstagramPost[];
} {
  try {
    const profile: InstagramProfile = {
      username: data.username,
      full_name: data.full_name,
      biography: data.biography,
      profile_pic_url: data.profile_pic_url,
      followers_count: data.followers,
      following_count: data.following,
      posts_count: data.posts_count
    };

    const posts: InstagramPost[] = data.posts?.map((post: any) => ({
      id: post.id,
      image_url: post.image_url,
      caption: post.caption,
      permalink: post.permalink,
      timestamp: post.timestamp,
      likes: post.likes
    })) || [];

    return { profile, posts: posts.slice(0, 12) };
  } catch (error) {
    console.warn('Erreur format API data:', error);
    return { profile: null, posts: [] };
  }
}

/**
 * Cache local pour éviter trop de requêtes
 */
function getCachedInstagramData(username: string): {
  profile: InstagramProfile | null;
  posts: InstagramPost[];
} | null {
  try {
    const cached = localStorage.getItem(`instagram_${username}`);
    if (cached) {
      const data = JSON.parse(cached);
      // Cache valide pendant 30 minutes
      if (Date.now() - data.timestamp < 30 * 60 * 1000) {
        return data.instagramData;
      }
    }
  } catch (error) {
    console.warn('Erreur cache Instagram:', error);
  }
  return null;
}

/**
 * Sauvegarde en cache
 */
function setCachedInstagramData(username: string, data: {
  profile: InstagramProfile | null;
  posts: InstagramPost[];
}) {
  try {
    localStorage.setItem(`instagram_${username}`, JSON.stringify({
      instagramData: data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Erreur sauvegarde cache Instagram:', error);
  }
}

/**
 * Données de fallback si le scraping échoue
 */
function getFallbackInstagramData(username: string): {
  profile: InstagramProfile | null;
  posts: InstagramPost[];
} {
  if (username === 'mauditemachine') {
    return {
      profile: {
        username: 'mauditemachine',
        full_name: 'Maudite Machine',
        biography: 'Montreal based DJ/Producer 🇨🇦 VRSTL Records founder 🎵 Dark disco & indie dance',
        profile_pic_url: '/medias/logo/mauditemachine-logo.png',
        followers_count: 0,
        following_count: 0,
        posts_count: 0
      },
      posts: [] // Pas de posts fallback, on affichera un message pour connecter Instagram
    };
  }
  
  return { profile: null, posts: [] };
}
