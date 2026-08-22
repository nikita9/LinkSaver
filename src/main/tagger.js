// Heuristic URL tagger: suggests tags from domain, TLD, and path keywords.

const DOMAIN_TAGS = {
    'github.com': ['github', 'code', 'programming', 'development'],
    'stackoverflow.com': ['stackoverflow', 'programming', 'development', 'coding'],
    'youtube.com': ['youtube', 'video', 'media', 'entertainment'],
    'medium.com': ['medium', 'article', 'blog', 'writing'],
    'dev.to': ['dev', 'programming', 'tutorial', 'development'],
    'twitter.com': ['twitter', 'social', 'social-media', 'networking'],
    'x.com': ['twitter', 'social', 'social-media', 'networking'],
    'linkedin.com': ['linkedin', 'professional', 'networking', 'career'],
    'reddit.com': ['reddit', 'discussion', 'community', 'social'],
    'news.ycombinator.com': ['hackernews', 'tech', 'startup', 'programming'],
    'npmjs.com': ['npm', 'javascript', 'package', 'development'],
    'codepen.io': ['codepen', 'frontend', 'css', 'javascript'],
    'dribbble.com': ['dribbble', 'design', 'ui', 'creative'],
    'behance.net': ['behance', 'design', 'portfolio', 'creative'],
    'figma.com': ['figma', 'design', 'ui', 'prototyping'],
    'aws.amazon.com': ['aws', 'cloud', 'infrastructure', 'development'],
    'docs.google.com': ['google-docs', 'document', 'productivity'],
    'wikipedia.org': ['wikipedia', 'reference', 'education', 'knowledge'],
    'google.com': ['google', 'search', 'reference'],
    'mermaid.live': ['mermaid', 'diagram', 'flowchart', 'documentation', 'tools']
};

const KEYWORD_TAGS = {
    tutorial: ['tutorial', 'education', 'learning'],
    api: ['api', 'development', 'programming'],
    docs: ['documentation', 'reference', 'development'],
    blog: ['blog', 'article', 'writing'],
    news: ['news', 'article', 'media'],
    shop: ['shopping', 'ecommerce', 'retail'],
    learn: ['education', 'learning', 'tutorial'],
    course: ['education', 'learning', 'course'],
    download: ['download', 'software', 'tools'],
    tool: ['tools', 'utility', 'productivity'],
    game: ['gaming', 'entertainment', 'games'],
    music: ['music', 'audio', 'entertainment'],
    photo: ['photography', 'images', 'media'],
    video: ['video', 'media', 'entertainment'],
    editor: ['tools', 'editor', 'productivity'],
    diagram: ['diagram', 'visualization', 'tools'],
    flowchart: ['flowchart', 'diagram', 'documentation']
};

const TLD_TAGS = {
    '.edu': ['education', 'academic', 'learning'],
    '.gov': ['government', 'official', 'public'],
    '.org': ['organization', 'non-profit', 'community'],
    '.io': ['tech', 'startup', 'development'],
    '.dev': ['development', 'programming', 'tech'],
    '.tech': ['technology', 'tech', 'innovation'],
    '.design': ['design', 'creative', 'ui'],
    '.blog': ['blog', 'writing', 'article'],
    '.live': ['tools', 'online', 'interactive']
};

const MAX_TAGS = 5;
const FALLBACK_TAGS = ['website', 'reference'];

export function analyzeUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return { ok: false, error: 'Invalid URL', tags: [...FALLBACK_TAGS] };
    }

    const domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const tags = new Set();

    for (const [pattern, domainTags] of Object.entries(DOMAIN_TAGS)) {
        if (domain === pattern || domain.endsWith(`.${pattern}`)) {
            domainTags.forEach((tag) => tags.add(tag));
            break;
        }
    }

    for (const [tld, tldTags] of Object.entries(TLD_TAGS)) {
        if (domain.endsWith(tld)) tldTags.forEach((tag) => tags.add(tag));
    }

    const pathText = `${parsed.pathname}${parsed.search}`.toLowerCase();
    for (const [keyword, keywordTags] of Object.entries(KEYWORD_TAGS)) {
        if (pathText.includes(keyword)) keywordTags.forEach((tag) => tags.add(tag));
    }

    if (tags.size === 0) {
        if (domain.includes('blog')) tags.add('blog');
        if (domain.includes('news')) tags.add('news');
        if (domain.includes('shop') || domain.includes('store')) tags.add('shopping');
        if (domain.includes('learn') || domain.includes('course')) tags.add('education');
        if (tags.size === 0) FALLBACK_TAGS.forEach((tag) => tags.add(tag));
    }

    const suggested = [...tags].slice(0, MAX_TAGS);
    return {
        ok: true,
        summary: `Analyzed ${domain} — ${suggested.length} suggested ${suggested.length === 1 ? 'tag' : 'tags'}`,
        tags: suggested
    };
}
