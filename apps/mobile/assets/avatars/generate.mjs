import {createAvatar} from '@dicebear/core';
import * as glass from '@dicebear/glass';
import sharp from 'sharp';
import fs from 'node:fs/promises';
const dest=process.argv[2];
const names=['Silver blue','Rose slate','Amber dusk','Sea glass','Lavender mist','Copper glow','Ocean ink','Moss light','Peach pearl','Plum frost','Sky stone','Graphite'];
const backgrounds=['687c96','9a7886','a28b65','63918e','8d83a6','a17965','536d87','7a8a71','aa8b81','81718e','7898ab','707478'];
const records=[];
for(let i=0;i<12;i++){
 const id=`glass-${String(i+1).padStart(2,'0')}`;
 const options={seed:`roundups-curated-${i+1}`,size:384,radius:50,backgroundColor:[backgrounds[i]]};
 const svg=createAvatar(glass,options).toString();
 await fs.writeFile(`${dest}/${id}.svg`,svg);
 await sharp(Buffer.from(svg)).png().toFile(`${dest}/${id}.png`);
 await sharp(Buffer.from(svg)).resize(28,28).png().toFile(`${dest}/${id}-tab.png`);
 await sharp(Buffer.from(svg)).resize(56,56).png().toFile(`${dest}/${id}-tab@2x.png`);
 await sharp(Buffer.from(svg)).resize(84,84).png().toFile(`${dest}/${id}-tab@3x.png`);
 records.push({id,name:`${names[i]} gradient`,options});
}
await fs.writeFile(`${dest}/manifest.json`,JSON.stringify({style:'DiceBear Glass',version:'9.2.4',license:glass.meta.license,variants:records},null,2)+'\n');
