import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertToEmbedUrl(url: string): string {
    if (!url) return '';
    // Check if it's already an embed link
    if (url.includes('/embed/')) {
        return url;
    }
    
    // Regular expression to find YouTube video ID from various URL formats
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
    }
    
    // If the input is just the 11-character video ID
    if (url.match(/^[\w-]{11}$/)) {
        return `https://www.youtube.com/embed/${url}`;
    }

    return url; // Return original url if no conversion was possible
}

export function convertToZoomEmbedUrl(url: string): string {
    if (!url) return '';

    // If it's already a /wc/ embed link, do nothing.
    if (url.includes('/wc/join/')) {
        return url;
    }

    // If it's a /j/ join link, convert it to the embed format.
    if (url.includes('/j/')) {
        return url.replace('/j/', '/wc/join/');
    }

    // If we don't have a known pattern, return the original URL.
    return url;
}
