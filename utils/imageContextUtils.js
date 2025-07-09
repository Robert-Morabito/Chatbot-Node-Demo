// Image generation keywords
const GENERATION_KEYWORDS = [
    'generate an image', 'create an image', 'draw', 'make a picture',
    'generate a picture', 'create a picture', 'image of', 'picture of',
    'draw me', 'show me a picture', 'visualize', 'illustrate',
    'make an image', 'create a visual', 'show me an image'
];

// Image modification keywords
const MODIFICATION_KEYWORDS = [
    'make it', 'change it', 'add', 'remove', 'but with', 'now with',
    'change the', 'make the', 'turn it', 'color it', 'paint it',
    'instead', 'modify', 'adjust', 'update', 'alter', 'transform',
    'redo', 'remake', 'regenerate', 'try again', 'different',
    'more', 'less', 'bigger', 'smaller', 'brighter', 'darker',
    'without', 'include', 'exclude', 'replace'
];

// Context continuation phrases
const CONTINUATION_PHRASES = [
    'another one', 'one more', 'again', 'try again', 'regenerate',
    'new version', 'different version', 'variation'
];

export function detectImageIntent(message, imageContext = {}) {
    const content = message.toLowerCase();
    
    // Check if this is a direct generation request
    const isDirectGeneration = GENERATION_KEYWORDS.some(keyword => 
        content.includes(keyword)
    );
    
    if (isDirectGeneration) {
        return {
            isImageRequest: true,
            type: 'new',
            reason: 'direct_generation_keyword'
        };
    }
    
    // If we have image context, check for modifications
    if (imageContext.lastPrompt) {
        // Check for modification keywords
        const isModification = MODIFICATION_KEYWORDS.some(keyword => 
            content.includes(keyword)
        );
        
        // Check for continuation phrases
        const isContinuation = CONTINUATION_PHRASES.some(phrase => 
            content.includes(phrase)
        );
        
        // Check if the message seems to be describing changes
        const describesChanges = /^(with|add|remove|include|make|change|but)/.test(content.trim());
        
        if (isModification || isContinuation || describesChanges) {
            return {
                isImageRequest: true,
                type: 'modification',
                reason: 'modification_detected'
            };
        }
    }
    
    return {
        isImageRequest: false,
        type: 'none',
        reason: 'no_image_intent'
    };
}

export function extractImagePrompt(message) {
    let prompt = message;
    
    // Remove common prefixes
    const prefixes = [
        'generate an image of', 'create an image of', 'draw me',
        'make a picture of', 'generate a picture of', 'create a picture of',
        'show me a picture of', 'image of', 'picture of', 'draw',
        'generate an image', 'create an image', 'make a picture',
        'show me a picture', 'visualize', 'illustrate',
        'make an image of', 'create a visual of'
    ];
    
    for (const prefix of prefixes) {
        const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
        if (regex.test(prompt)) {
            prompt = prompt.replace(regex, '').trim();
            break;
        }
    }
    
    return prompt || message;
}

export function mergePromptWithModification(basePrompt, modification) {
    // Handle specific modification patterns
    const modLower = modification.toLowerCase();
    
    // Simple additions
    if (modLower.startsWith('add ')) {
        return `${basePrompt}, ${modification}`;
    }
    
    // Color changes
    if (modLower.includes('make it ') || modLower.includes('change it to ')) {
        const change = modification.replace(/make it |change it to /i, '');
        return `${basePrompt}, but ${change}`;
    }
    
    // Style modifications
    if (modLower.includes('in the style of') || modLower.includes('style')) {
        return `${basePrompt}, ${modification}`;
    }
    
    // "But with" modifications
    if (modLower.startsWith('but ')) {
        return `${basePrompt}, ${modification}`;
    }
    
    // "With" additions
    if (modLower.startsWith('with ')) {
        return `${basePrompt} ${modification}`;
    }
    
    // Remove something
    if (modLower.includes('without') || modLower.includes('remove')) {
        return `${basePrompt}, ${modification}`;
    }
    
    // Size/quantity changes
    if (modLower.match(/\b(more|less|bigger|smaller|larger)\b/)) {
        return `${basePrompt}, but ${modification}`;
    }
    
    // Default: append as modification
    return `${basePrompt}, ${modification}`;
}