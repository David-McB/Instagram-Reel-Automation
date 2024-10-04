import Editor from './editor.js';
import prompts from 'prompts';
import type { EditorOptions } from './types/editorOptions.js';
import download from './download.js';
import 'dotenv/config';

const youtubeRegex = /^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/;

if (process.env.DEVELOPMENT) initiateImmediateDownload();
else {
    (async () => {
        const response = await prompts([
            {
                type: 'text',
                name: 'url',
                message: "Please paste a YouTube download URL and press 'enter'",
                validate: value => youtubeRegex.test(value) ? true : 'Please enter a link to a valid Youtube video'
            },
            {
                type: 'number',
                name: 'start',
                message: "Please enter the time in seconds you would like to start the reel from. Enter '0' to start the reel from the beginning of the video"
            }
        ]);

        const { url, start } = response;

        const endResponse = await prompts({
            type: 'number',
            name: 'end',
            message: 'Please enter the time in seconds you would like to end the reel at',
            validate: value => value - start <= 90 ? true : 'Total reel duration must be 90 seconds or less'
        })

        const end = endResponse.end;

        const options: EditorOptions = {
            savedReelLocation: './convertedReel.mp4',
            trimTimestamp: { start, end }
        };

        const editor = new Editor(options);
        
        try {
            await download(url);
            console.log('\nDownload completed. Processing reel..');
            await editor.createReel();
        }

        catch(error: any) {
            throw new Error(error);
        }
})();
}

async function initiateImmediateDownload() {
    // await Editor.verifyReelSaveLocation();

    const editor = new Editor({
        savedReelLocation: './convertedReel.mp4',
        trimTimestamp: {start: 0, end: 30}
    });

    const URL = "https://www.youtube.com/watch?v=3YWIIV19U70&t=4s&pp=ygUYa2VubmVkeSBtb29uIHNwZWVjaCBjbGlw";

    try {
        await download(URL);
        console.log('\nDownload completed. Creating reel...');
        await editor.createReel();
    }

    catch(error: any) {
        throw new Error(error);
    }
}



 