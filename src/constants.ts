import os from 'node:os';

export const INSTAGRAM_ASPECT_RATIO = '9:16';
export const SUBTITLE_API_URL = 'http://127.0.0.1:5000/subtitles'
export const DEFAULT_REEL_FILENAME = 'convertedReel';

// File locations
export const REEL_SAVE_DIRECTORY = os.homedir() + '/Desktop/Reels/'
export const VIDEO_PATH = './videoToConvert.mp4';
export const AUDIO_PATH = './audioToConvert.mp3';
export const TRIMMED_AUDIO_PATH = './trimmedAudioToConvert.mp3';
export const SRT_SAVE_LOCATION = './';