import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstall from '@ffmpeg-installer/ffmpeg';
import ffProbeInstall from '@ffprobe-installer/ffprobe';
import open from 'open';
import { promises as fs } from 'fs';
import type { EditorOptions } from './types/editorOptions';
import { INSTAGRAM_ASPECT_RATIO, VIDEO_PATH, AUDIO_PATH, TRIMMED_AUDIO_PATH, SRT_SAVE_LOCATION, REEL_SAVE_DIRECTORY, SUBTITLE_API_URL, DEFAULT_REEL_FILENAME } from './constants.js';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegInstall.path);
ffmpeg.setFfprobePath(ffProbeInstall.path);

class Editor {
    private savedReelLocation: string;
    private reelFilename: string;
    private startTimeSeconds: number;
    private endTimeSeconds: number;
    private reelDuration: number;
    private videoName?: string;

    constructor(options: EditorOptions) {
        this.savedReelLocation = options.savedReelLocation;
        this.reelFilename = DEFAULT_REEL_FILENAME + '.mp4';
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
        });
    }

    public static async verifyReelSaveLocation(): Promise<void> {
        console.log("Verifying reel save directory...");
        try {
            await fs.access(REEL_SAVE_DIRECTORY, fs.constants.R_OK | fs.constants.W_OK);
            console.log(`Reel save directory ${REEL_SAVE_DIRECTORY} found`);
        }

        catch(error) {
            console.warn(`Reel save directory (${REEL_SAVE_DIRECTORY}) does not exist. Creating directory...\n`)
            await fs.mkdir(REEL_SAVE_DIRECTORY, {recursive: true})
        }
    }

    private async requestSubtitles(filePath: string): Promise<void> {
        console.log('Generating AI subtitles. Please wait - this could take some time...\n');
        const url = SUBTITLE_API_URL + "/?audio_path=" + encodeURIComponent(path.resolve(filePath)) + "&srt_save_location="
        + encodeURIComponent(path.resolve(SRT_SAVE_LOCATION));

        try {
            const response = await fetch(url);
            if (response.ok) console.log('Subtitle generation completed\n');
            else {
                throw new Error(`Subtitle generation failed. Error code: ${response.status}`);
            }
        }

        catch(error) {
            console.log(error);
        }
    }

    public async createReel() {
        if (this.videoName) {
            const newReelName = this.videoName.match(/[\w- ]/g)?.join('').replaceAll(' ', '-');
            if (newReelName) this.setReelFilename(newReelName);
        }

        const [ width, height ] = await this.computeCropDimensions(INSTAGRAM_ASPECT_RATIO);
        const logoWidth = width > 500 ? 220 : 100; // Logo may not be centered for resolutions < 1080p
        
        console.log('Target path: ' + this.savedReelLocation + this.reelFilename)

        // Trim audio first before generating subtitles to ensure it stays in sync
        console.log('Trimming reel audio. Please wait...')

        await new Promise<void>((resolve, reject) => {
            ffmpeg(AUDIO_PATH)
            .audioFilters([
                {filter: 'atrim', options: {start: this.startTimeSeconds, end: this.endTimeSeconds}},
                {filter: 'asetpts', options: 'PTS-STARTPTS'}
            ])
            .output(TRIMMED_AUDIO_PATH)
            .on('progress', progress => {
                if (!progress.percent) return;
            })
            .on('error', error => {
                console.log(`Unable to processs audio: ${error.message}`);
                reject(error.message);
            })
            .on('end', () => {
                console.log('Audio trim completed\n');
                resolve();
            })
            .run();
        });

        await this.requestSubtitles(TRIMMED_AUDIO_PATH);

        ffmpeg(VIDEO_PATH)
        .input(AUDIO_PATH)
        .input('./data/logo.png')
        .complexFilter([
            {filter: 'color', options: {color: 'black@.4', size: `${+width}x${+height}`, duration: this.reelDuration}, outputs: 'overlay'},
            {filter: 'crop', options: {w: width, h: height}, inputs: '0:v', outputs: 'croppedReel'},
            {filter: 'trim', options: {start: this.startTimeSeconds, end: this.endTimeSeconds }, inputs: 'croppedReel', outputs: 'trimmedReel'},
            {filter: 'setpts', options: 'PTS-STARTPTS', inputs: 'trimmedReel', outputs: 'newTrimmedReel'},
            {filter: 'overlay', options: {x: 0, y: 0}, inputs: ['newTrimmedReel', 'overlay'], outputs: 'darkenedReel'},
            {filter: 'scale', options: {w: '157.5', h: '118.1'}, inputs: '2:v', outputs: 'scaledLogo'},
            {filter: 'overlay', options: {x: logoWidth, y: 130, format: 'rgb'}, inputs: ['darkenedReel', 'scaledLogo'], outputs: 'reelWithLogo'},
            {filter: 'subtitles', options: {filename: SRT_SAVE_LOCATION + '/subtitles.srt', force_style: "Alignment=10,FontName=Avenir Next Bold,Fontsize=8,MarginL=5,MarginV=25,Outline=0"}, inputs: 'reelWithLogo'}
        ])
        .audioFilters([
            {filter: 'atrim', options: {start: this.startTimeSeconds, end: this.endTimeSeconds}},
            {filter: 'asetpts', options: 'PTS-STARTPTS'}
        ])
        .outputOptions(["-map 1:a"])
        .output(this.savedReelLocation + this.reelFilename)
        .videoBitrate(15000)
        .on('progress', progress => {
            
            if (!progress.percent) return;
            const [ hours, minutes ] = progress.timemark.split(':');
            const seconds = Math.round(+progress.timemark.split(":")[2]);
            const totalSeconds = +hours * 60 * 60 + (+minutes) * 60 + seconds;
            const progressPercentage = (totalSeconds / this.reelDuration) * 100;
            console.log(`Processing reel: ${Math.floor(progressPercentage)}% done`);
        })
        .on('error', error => console.log(`Unable to process video: ${error.message}`))
        .on('end', async () => {
            console.log('\nReel completed');
            await Promise.all([fs.unlink(VIDEO_PATH), fs.unlink(AUDIO_PATH), fs.unlink(TRIMMED_AUDIO_PATH), fs.unlink(SRT_SAVE_LOCATION + '/subtitles.srt')]);
            open(this.savedReelLocation + this.reelFilename);
        })
        .run()
    }

    public setVideoName(name: string) {
        this.videoName = name;
    }

    private setReelFilename(name: string) {
        this.reelFilename = name + '.mp4';
    }
}

export default Editor;
