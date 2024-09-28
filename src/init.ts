import Editor from './editor.js';
import type { EditorOptions } from './types/editorOptions.js';

const options: EditorOptions = {
    videoPath: './speech.mp4',
    savedVideoLocation: './convertedReel.mp4',
    trimTimestamp: {start: 1, end: 20}
};

(async () => {
    const editor = new Editor(options);
    await editor.createReel();
})()

 