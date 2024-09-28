import ffmpeg from 'fluent-ffmpeg';
import type { EditorOptions } from './types/editorOptions';
import { INSTAGRAM_ASPECT_RATIO } from './constants.js';

class Editor {
    private videoPath: string;
    private savedVideoLocation: string;
    private startTimeSeconds: number;
    private endTimeSeconds: number;

    constructor(options: EditorOptions) {
        this.videoPath = options.videoPath;
        this.savedVideoLocation = options.savedVideoLocation;
        this.startTimeSeconds = options.trimTimestamp.start;
        this.endTimeSeconds = options.trimTimestamp.end - options.trimTimestamp.start;
    }

    /** Finds maximum possible size for a video for a given aspect ratio */
    private computeCropDimensions(aspectRatio: `${number}:${number}`): Promise<[number, number]> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(this.videoPath, (error, metadata) => {
                const [targetWidth, targetHeight] = aspectRatio.split(':');
                const videoHeight = metadata.streams[0].height;
                const videoWidth = metadata.streams[0].width;
    
                if (!videoHeight || !videoWidth) reject(Error('Video width/height could not be found'));
    
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
        const [reelWidth, reelHeight ] = INSTAGRAM_ASPECT_RATIO;

        ffmpeg(this.videoPath)
        .input('./data/logo.png')
        .complexFilter([
            {filter: 'crop', options: {w: width, h: height}, inputs: '0:v', outputs: 'croppedReel'},
            {filter: 'trim', options: {start: this.startTimeSeconds, end: this.endTimeSeconds}, inputs: 'croppedReel', outputs: 'trimmedReel'},
            // {filter: 'color', options: {c: 'white'}},
            {filter: 'scale', options: {w: '157.5', h: '118.1'}, inputs: '1:v', outputs: 'scaledLogo'},
            {filter: 'overlay', options: {x: 130, y: 0}, inputs: ['trimmedReel', 'scaledLogo']},
        ])
        .audioFilters([
            {filter: 'atrim', options: {start: this.startTimeSeconds, end:this.endTimeSeconds}}
        ])
        .outputOptions(["-map 0:a"])
        .output(this.savedVideoLocation)
        .videoBitrate(15000)
        .on('progress', progress => console.log(`Processing reel: ${Math.floor(progress.percent || 0)}% done`))
        .on('error', error => console.log(`Unable to process video: ${error.message}`))
        .on('end', () => console.log('Completed'))
        .run()
    }
}

export default Editor;
