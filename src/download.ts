import { createWriteStream } from 'fs';
import * as readline from 'readline';
import ytdl from '@distube/ytdl-core';
import { AUDIO_PATH, VIDEO_PATH } from './constants.js';

const download = async (url: string) => {
    const video = ytdl(url, { quality: 'highest' });
    const audio = ytdl(url, { filter: format => {
        const audioOnly = format.hasAudio && !format.hasVideo;
        if (!format.url.includes("lang")) return audioOnly;
        else return audioOnly && format.url.includes("lang%3Den");
    }});

    const videoDownload = new Promise<void>((resolve, reject) => {
        video.pipe(createWriteStream(VIDEO_PATH));
        audio.pipe(createWriteStream(AUDIO_PATH));

        video.on('progress', (chunkLength, downloaded, total) => {
            const currentPercentage = downloaded / total;
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`Video downloading: ${(Math.floor(currentPercentage * 100))}% downloaded`);
            readline.moveCursor(process.stdout, 0, -1);
        });

        video.on('error', error => {
            reject(new Error('An error occurred downloading video: ' + error));
        })

        video.on('end', () => {
            process.stdout.write('\n\n');
            resolve();
        });
    });

    const audioDownload = new Promise<void>((resolve, reject) => {
        console.clear();
        audio.on('progress', (chunkLength, downloaded, total) => {
            const currentPercentage = downloaded / total;
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`Audio downloading: ${Math.floor((currentPercentage * 100))}% downloaded`);
            readline.moveCursor(process.stdout, 0, -1);
        });

        audio.on('error', error => {
            reject(new Error('An error occurred downloading audio: ' + error));
        });

        audio.on('end', () => {
            process.stdout.write('\n\n');
            resolve();
        });
    });

    const getInfo = ytdl.getBasicInfo(url);

    return Promise.all([videoDownload, audioDownload, getInfo]);
}

export default download;