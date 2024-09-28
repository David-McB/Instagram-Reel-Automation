import Editor from './editor.js';
import type { EditorOptions } from './types/editorOptions.js';
import download from './download.js';

const options: EditorOptions = {
    savedReelLocation: './convertedReel.mp4',
    trimTimestamp: {start: 1, end: 20}
};

const url = 'https://www.youtube.com/watch?v=SPLiSjENBTY';

const youtubeRegex = /^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/;
        // if (!url || !youtubeRegex.test(url)) reject(new Error('Invalid video URL'));

const init = async () => {
    const editor = new Editor(options);
    
    try {
        await download(url);
        console.log('Download completed');
        await editor.createReel();
    }

    catch(error: any) {
        throw new Error(error);
    }
};

init();

 