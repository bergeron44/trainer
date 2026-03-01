const { v2: cloudinary } = require('./server/node_modules/cloudinary');
cloudinary.config({ cloud_name:'dgmgsqam5', api_key:'991354661967541', api_secret:'Sn8Ch94cokbKg4iRcX1I-wzlBBw' });
const fs = require('fs');

async function run() {
  let all = [], cursor = null;
  do {
    const opts = { resource_type:'video', max_results:500 };
    if (cursor) opts.next_cursor = cursor;
    const res = await cloudinary.api.resources(opts);
    all.push(...res.resources);
    cursor = res.next_cursor;
  } while (cursor);

  const ids = all.map(r => r.public_id).sort();
  const template = fs.readFileSync('/tmp/classify-videos.html','utf8');
  const final = template.replace('__VIDEOS_JSON__', JSON.stringify(ids));
  fs.writeFileSync('/tmp/classify-videos.html', final);

  const named = ids.filter(id => !id.startsWith('grok-') && !id.startsWith('samples/'));
  console.log('Total:', ids.length, '| Named:', named.length, '| Grok:', ids.filter(id=>id.startsWith('grok-')).length);
  named.forEach(n => console.log(' named:', n));
}
run().catch(e => console.error(e.message));
