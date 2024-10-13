import Editor from './editor.js';
import prompts from 'prompts';
import type { EditorOptions } from './types/editorOptions.js';
import download from './download.js';
import 'dotenv/config';
import { REEL_SAVE_DIRECTORY} from './constants.js';

const youtubeRegex = /^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/;
if (process.env.DEVELOPMENT === 'true') initiateImmediateDownload();
else init();

async function initiateImmediateDownload() {
    await Editor.verifyReelSaveLocation();

    const editor = new Editor({
        savedReelLocation: REEL_SAVE_DIRECTORY,
        trimTimestamp: {start: 20, end: 100}
    });

    const URL = "https://www.youtube.com/watch?v=ljqra3BcqWM";

    try {
        const info = await download(URL);
        editor.setVideoName(info[2].videoDetails.title);
        console.log('\nDownload completed. Creating reel...\n');
        await editor.createReel();
    }

    catch(error: any) {
        throw new Error(error);
    }
}

const convertStartAndEndTimes = (num1: string, num2: string): number[] => {
    return [num1, num2].map(num => {
        const timestamp = num.split(':');
        if (timestamp.length === 1) return +num;
        return +timestamp[0] * 60 + +timestamp[1];
    })
}

async function init() {
    const response = await prompts([
        {
            type: 'text',
            name: 'url',
            message: "Please paste a YouTube download URL and press 'enter'",
            validate: value => youtubeRegex.test(value) ? true : 'Please enter a link to a valid YouTube video'
        },
        {
            type: 'text',
            name: 'start',
            message: "Please enter the time in seconds, or the timestamp in format MM:SS, you would like to start the reel from. Enter '0' to start the reel from the beginning of the video"
        }
    ]);

    const { url, start } = response;

    const endResponse = await prompts({
        type: 'text',
        name: 'end',
        message: 'Please enter either the time in seconds, or the timestamp in format MM:SS, you would like to end the reel at'
    })

    const end = endResponse.end;

    const [ startSeconds, endSeconds ] = convertStartAndEndTimes(start, end);

    const options: EditorOptions = {
        savedReelLocation: REEL_SAVE_DIRECTORY,
        trimTimestamp: { start: startSeconds, end: endSeconds }
    };

    const editor = new Editor(options);

    try {
        const info = await download(url);
        editor.setVideoName(info[2].videoDetails.title);
        console.log('\nDownload completed. Creating reel...\n');
        await editor.createReel();
    }

    catch(error: any) {
        throw new Error(error);
    }
}



 