import ffmpeg from 'fluent-ffmpeg';
import open from 'open';
import { promises as fs } from 'fs';
import type { EditorOptions } from './types/editorOptions';
import { INSTAGRAM_ASPECT_RATIO, VIDEO_PATH, AUDIO_PATH } from './constants.js';

class Editor {
    private savedReelLocation: string;
    private startTimeSeconds: number;
    private endTimeSeconds: number;
    private reelDuration: number;

    constructor(options: EditorOptions) {
        this.savedReelLocation = options.savedReelLocation;
        this.startTimeSeconds = options.trimTimestamp.start;
        this.endTimeSeconds = options.trimTimestamp.end;
        this.reelDuration = this.endTimeSeconds - this.startTimeSeconds;
    }

    /** Finds maximum possible size for a video for a given aspect ratio */
    private computeCropDimensions(aspectRatio: `${number}:${number}`): Promise<[number, number]> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(VIDEO_PATH, (error, metadata) => {
                if (error) reject(error);
                const [targetWidth, targetHeight] = aspectRatio.split(':');
                const videoHeight = metadata.streams[0].height;
                const videoWidth = metadata.streams[0].width;
    
                if (!videoHeight || !videoWidth) reject('Video width/height could not be found');
    
                let computedWidth = 1, computedHeight = 1;
    
                while (computedWidth < videoWidth! && computedHeight < videoHeight!) {
                    computedWidth += +targetWidth;
                    computedHeight += +targetHeight;
                }
    
                computedHeight -= +targetWidth;
                computedHeight -= +targetHeight;
                
                resolve([computedWidth, computedHeight]);
            })
        })
    }

    public async createReel() {
        const [ width, height ] = await this.computeCropDimensions(INSTAGRAM_ASPECT_RATIO);
        const logoWidth = width > 500 ? 220 : 100; // Logo may not be centered for resolutions < 1080p

        ffmpeg(VIDEO_PATH)
        .input(AUDIO_PATH)
        .input('./data/logo.png')
        .complexFilter([
            {filter: 'color', options: {color: 'black@.4', size: `${+width}x${+height}`, duration: this.reelDuration}, outputs: 'overlay'},
            {filter: 'crop', options: {w: width, h: height}, inputs: '0:v', outputs: 'croppedReel'},
            {filter: 'trim', options: {start: this.startTimeSeconds, end: this.endTimeSeconds }, inputs: 'croppedReel', outputs: 'trimmedReel'},
            {filter: 'setpts', options: 'PTS-STARTPTS', inputs: 'trimmedReel', outputs: 'newTrimmedReel'},
            {filter: 'overlay', options: {x: 0, y: 0}, inputs: ['newTrimmedReel', 'overlay'], outputs: 'test'},
            {filter: 'scale', options: {w: '157.5', h: '118.1'}, inputs: '2:v', outputs: 'scaledLogo'},
            {filter: 'overlay', options: {x: logoWidth, y: 130}, inputs: ['test', 'scaledLogo'], outputs: 'reelWithLogo'},
            {filter: 'subtitles', options: {filename: './audio.srt', force_style: "Alignment=10,FontName=Avenir Next Bold,Fontsize=12,MarginL=5,MarginV=25,Outline=0"}, inputs: 'reelWithLogo'}
        ])
        .audioFilters([
            {filter: 'atrim', options: {start: this.startTimeSeconds, end: this.endTimeSeconds}},
            {filter: 'asetpts', options: 'PTS-STARTPTS'}
        ])
        .outputOptions(["-map 1:a"])
        .output(this.savedReelLocation)
        .videoBitrate(15000)
        .on('progress', progress => {
            if (!progress.percent) return;
            console.log(`Processing reel: ${Math.floor(progress.percent)}% done`)
        })
        .on('error', error => console.log(`Unable to process video: ${error.message}`))
        .on('end', async () => {
            console.log('\nReel completed');
            await Promise.all([fs.unlink(VIDEO_PATH), fs.unlink(AUDIO_PATH)]);
            open(this.savedReelLocation);
        })
        .run()
    }
}

export default Editor;
