import fs from 'fs';
import { Converter } from 'showdown';

//
// Reads the individual sections from the markup file and 
//   builds a json file with html entries for each section
//
function buildDocs(markdownPath : string, outputPath : string, varName: string) {

    let content: string = fs.readFileSync(markdownPath).toString('utf-8');
    const converter = new Converter();

    const matches = content.match(/<!--\slabel:([\n\r]|.)+?(?=<!--)/g);
    if (matches == null) return;

    const output: Record<string, unknown> = {};

    for (let i = 0; i < matches.length; i++) {
        let section = matches[i];
        const label = /<!--\s*label:(\w+)/.exec(section)![1];
        const side = /<!--\s*label:\w+\s+side:(\w+)/.exec(section)![1] === 'left' ? 'l' : 'r';
        const markdown = /-->(([\n\r]|.)+?)$/.exec(section)![1];
        const html = converter.makeHtml(markdown);

        output[label] = output[label] || {};
        (output[label] as Record<string, unknown>)[side] = html;
    }

    fs.writeFileSync(outputPath, Buffer.from("const " + varName + " = " + JSON.stringify(output, null, 2)));

}

buildDocs('./docs/verifierDocs.md', './public/verifierDocs.js', 'verifierDocs');
buildDocs('./docs/developerDocs.md', './public/developerDocs.js', 'developerDocs');